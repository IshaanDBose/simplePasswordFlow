"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { CheckSquare, CrossSquare, Spinner, WarningSquare } from "./Icons";
import {
  CELL_W,
  CELL_H,
  OUTER_RADIUS,
  PasscodeCell,
  type Palette,
} from "./PasscodeCell";
import {
  CODE_LENGTH,
  CREATE_SUBTEXT,
  CREATE_TITLE,
  announcement,
  isEditable,
  ringIndex,
  type PasscodeState,
} from "@/lib/passcode-machine";

/**
 * Vertical offset of the status row, in px, while the cells are on screen.
 * Figma's frames disagree by 1px on the cells' y (427 empty/filling, 426
 * submit). The cells are pinned to the true centre so they do not twitch when
 * verification starts, and -97 then lands the header on Figma's y=394.
 */
const ROW_OFFSET = -97;

const GROUP_W = CELL_W * CODE_LENGTH;

/** Breathing room kept around the group on small screens. */
const MIN_GUTTER = 16;

/** Vertical span the stage needs, in px: the status row reaches 113px above
 *  centre and the retry/reset button 121px below it. */
const STAGE_H = 260;

const SPRING = { type: "spring" as const, stiffness: 440, damping: 34, mass: 0.9 };

/** Radius of the ring's own corners, in px. */
const RING_RADIUS = 4;

/* Success sequence, in seconds from the check appearing: the cells clear, then
   the status row descends into the empty centre. */
const CELLS_EXIT_DELAY = 0.16;
const ROW_DESCENT_DELAY = 0.34;

/** Seconds the group waits before fading back in, so the old digits (0.16s
 *  exit) are gone rather than flashing behind it. */
const DIGITS_CLEAR_DELAY = 0.2;

/** Seconds the status row takes to fade. Its y is repositioned only after
 *  this, or it streaks 100px up the screen on its way out. */
const ROW_FADE = 0.2;

/** Centre offset of the action button, in px. Level with the caption slot,
 *  23px below the cells, so it clears the group as that comes back. */
const RESET_BUTTON_OFFSET = 104;

/**
 * The ring shares the cell's box, so on the end cells its outer corners take
 * the group's 16px radius or a 4px corner cuts across the rounded edge behind
 * it. Longhands, so each corner can animate as the ring slides.
 */
function ringCorners(index: number) {
  const first = index === 0;
  const last = index === CODE_LENGTH - 1;
  return {
    borderTopLeftRadius: first ? OUTER_RADIUS : RING_RADIUS,
    borderBottomLeftRadius: first ? OUTER_RADIUS : RING_RADIUS,
    borderTopRightRadius: last ? OUTER_RADIUS : RING_RADIUS,
    borderBottomRightRadius: last ? OUTER_RADIUS : RING_RADIUS,
  };
}

function paletteFor(status: PasscodeState["status"]): Palette {
  if (status === "submitting") return "disabled";
  if (status === "error") return "error";
  // `unavailable` keeps the default palette: the code was never checked, so
  // only the status row reports it.
  return "default";
}

interface Props {
  state: PasscodeState;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handlers: {
    onFocus: () => void;
    onBlur: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSelect: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  };
  onReset: () => void;
  onRetry: () => void;
  onStartCreate: () => void;
  onCancelCreate: () => void;
}

export function PasscodeFlow({
  state,
  inputRef,
  handlers,
  onReset,
  onRetry,
  onStartCreate,
  onCancelCreate,
}: Props) {
  const reduced = useReducedMotion() ?? false;
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const failures = useRef(state.failures);
  const rejections = useRef(state.rejections);

  const { status, code, focused, intent } = state;
  // While a new passcode is being chosen the guiding line reuses the status
  // row's slot, and the subtext the caption's.
  const creating = intent === "create" && isEditable(status);
  const caption = creating ? CREATE_SUBTEXT : state.caption;

  const showCells = status !== "success" && status !== "created";
  const rowVisible =
    creating ||
    status === "submitting" ||
    status === "success" ||
    status === "error" ||
    status === "unavailable" ||
    status === "created";
  const rowY = status === "success" || status === "created" ? 0 : ROW_OFFSET;

  // Offered after any failed attempt, and kept past the error status, which
  // clears itself after 900ms.
  const showForgot =
    intent === "verify" &&
    state.attempts > 0 &&
    isEditable(status) &&
    status !== "created";

  // Both shakes fire only when their counter increases: "Start over" zeroes
  // the counters, and reacting to any change would shake on reset too.
  useEffect(() => {
    const previous = failures.current;
    failures.current = state.failures;
    if (state.failures <= previous) return;
    if (reduced || !scope.current) return;
    animate(
      scope.current,
      { x: [0, -12, 10, -7, 4, 0] },
      { duration: 0.42, ease: "easeInOut" },
    );
  }, [state.failures, animate, reduced, scope]);

  useEffect(() => {
    const previous = rejections.current;
    rejections.current = state.rejections;
    if (state.rejections <= previous) return;
    if (reduced || !scope.current) return;
    animate(
      scope.current,
      { x: [0, -5, 4, -2, 0] },
      { duration: 0.22, ease: "easeInOut" },
    );
  }, [state.rejections, animate, reduced, scope]);

  // One button slot, four jobs; at most one applies at a time.
  const action: {
    key: string;
    label: string;
    onClick: () => void;
    primary: boolean;
    delay: (reduced: boolean) => number;
  } | null = creating
    ? {
        key: "cancel",
        label: "Cancel",
        onClick: onCancelCreate,
        primary: false,
        delay: () => 0.12,
      }
    : status === "unavailable"
      ? {
          key: "retry",
          label: "Try again",
          onClick: onRetry,
          primary: true,
          delay: () => 0.12,
        }
      : status === "success"
        ? {
            key: "reset",
            label: "Start over",
            onClick: onReset,
            primary: false,
            // Offered a beat after the success sequence has finished.
            delay: (r) => (r ? 0.2 : 1.1),
          }
        : showForgot
          ? {
              key: "forgot",
              label: "Forgot passcode?",
              onClick: onStartCreate,
              primary: false,
              delay: () => 0.2,
            }
          : null;

  const palette = paletteFor(status);
  const ring = ringIndex(code);
  const ringVisible = focused && showCells && status !== "submitting";

  // The group is a fixed 336px wide, wider than a small phone with gutters.
  // Scaling the stage keeps the proportions and the -97px handoff intact, and
  // only ever scales down, so the desktop layout stays pixel-exact.
  const stageRef = useRef<HTMLDivElement>(null);

  // Written to a CSS variable rather than React state, so nothing re-renders.
  const applyScale = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const scale = Math.min(
      1,
      (width - MIN_GUTTER * 2) / GROUP_W,
      (height - MIN_GUTTER * 2) / STAGE_H,
    );
    el.style.setProperty("--stage-scale", String(Math.max(scale, 0.2)));
  }, []);

  // Re-measured after every render, not just on mount: collapsing the panel
  // changes the stage's width without the window resizing, and hydration
  // commits once at the desktop width before the mobile default applies.
  useEffect(applyScale);

  useEffect(() => {
    window.addEventListener("resize", applyScale);
    return () => window.removeEventListener("resize", applyScale);
  }, [applyScale]);

  return (
    <div
      ref={stageRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "scale(var(--stage-scale, 1))",
          transformOrigin: "center center",
        }}
      >
      {/* Status row — verifying / authenticated / incorrect */}
      <motion.div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          translate: "-50% -50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          pointerEvents: "none",
        }}
        initial={false}
        animate={{
          opacity: rowVisible ? 1 : 0,
          y: rowVisible ? rowY : rowY - 8,
          scale: rowVisible ? 1 : 0.96,
        }}
        transition={
          reduced
            ? { duration: 0.15 }
            : {
                opacity: { duration: ROW_FADE },
                scale: SPRING,
                y: {
                  ...SPRING,
                  // Descending waits for the cells to clear; leaving waits for
                  // the fade, so the row dissolves where it stands.
                  delay: !rowVisible
                    ? ROW_FADE
                    : status === "success"
                      ? ROW_DESCENT_DELAY
                      : 0,
                },
              }
        }
        aria-hidden={!rowVisible}
      >
        {/* No icon while choosing a new passcode. */}
        <div
          style={{
            width: creating ? 0 : 32,
            height: 32,
            position: "relative",
            transition: "width 160ms ease-out",
          }}
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={creating ? "creating" : status}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: reduced ? 0.1 : 0.16 }}
              style={{ position: "absolute", inset: 0 }}
            >
              {!creating && status === "submitting" && <Spinner />}
              {!creating &&
                (status === "success" || status === "created") && (
                  <CheckSquare draw={!reduced} />
                )}
              {!creating && status === "error" && <CrossSquare />}
              {!creating && status === "unavailable" && <WarningSquare />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div style={{ position: "relative", height: 29 }}>
          <AnimatePresence initial={false} mode="wait">
            <motion.p
              key={creating ? "creating" : status}
              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -4 }}
              transition={{ duration: reduced ? 0.1 : 0.16 }}
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 500,
                lineHeight: "normal",
                color: "var(--text-color-1)",
                whiteSpace: "nowrap",
              }}
            >
              {creating && CREATE_TITLE}
              {!creating && status === "submitting" && "Verifying..."}
              {!creating && status === "success" && "Authenticated"}
              {!creating && status === "created" && "Passcode updated"}
              {!creating && status === "error" && "Incorrect passcode"}
              {!creating && status === "unavailable" && "Couldn't verify"}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* The passcode group */}
      <motion.div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          translate: "-50% -50%",
        }}
        initial={false}
        animate={{
          opacity: showCells ? 1 : 0,
          // Scale, not y: drifting up would meet the descending status row.
          scale: showCells ? 1 : 0.96,
        }}
        transition={{
          duration: reduced ? 0.15 : 0.22,
          ease: "easeOut",
          delay: reduced ? 0 : showCells ? DIGITS_CLEAR_DELAY : CELLS_EXIT_DELAY,
        }}
        aria-hidden={!showCells}
      >
        <div ref={scope} style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: GROUP_W,
              height: CELL_H,
            }}
          >
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <PasscodeCell
                key={i}
                index={i}
                digit={code[i] ?? null}
                palette={status === "success" ? "success" : palette}
                enterDelay={
                  state.lastInputKind === "paste" && !reduced ? i * 0.045 : 0
                }
                showCaret={ringVisible && ring === i}
                reduced={reduced}
              />
            ))}
          </div>

          {/* Highlight ring: one element that slides between cells. */}
          <motion.div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              boxSizing: "border-box",
              width: CELL_W,
              height: CELL_H,
              borderWidth: 3,
              borderStyle: "solid",
              boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
              pointerEvents: "none",
            }}
            initial={false}
            animate={{
              x: ring * CELL_W,
              opacity: ringVisible ? 1 : 0,
              borderColor:
                status === "error" ? "var(--error)" : "var(--highlight)",
              ...ringCorners(ring),
            }}
            transition={{
              x: reduced ? { duration: 0 } : SPRING,
              opacity: { duration: reduced ? 0 : 0.14 },
              borderColor: { duration: 0.18 },
              // Corners resolve quicker than the slide, so the ring has
              // squared off before it reaches a middle cell.
              borderTopLeftRadius: { duration: reduced ? 0 : 0.18 },
              borderBottomLeftRadius: { duration: reduced ? 0 : 0.18 },
              borderTopRightRadius: { duration: reduced ? 0 : 0.18 },
              borderBottomRightRadius: { duration: reduced ? 0 : 0.18 },
            }}
          />

          {/* One real input drives the cells above: native gets paste, key
              repeat on backspace, the mobile numeric keyboard and
              one-time-code autofill for free. */}
          <input
            ref={inputRef}
            className="passcode-native-input"
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            spellCheck={false}
            autoCorrect="off"
            aria-label={`Passcode, ${CODE_LENGTH} digits`}
            // `readOnly`, not `disabled`: the machine already ignores input
            // while verifying, and staying focusable means the ring comes back
            // after a failure without another click.
            readOnly={status === "submitting"}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              // 36px keeps iOS from zooming the viewport on focus.
              fontSize: 36,
              opacity: 0,
              cursor: "default",
            }}
            {...handlers}
          />
        </div>
      </motion.div>

      {/* Transient caption: refusals, and the hint after repeated failures. */}
      <motion.div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          translate: "-50% -50%",
          pointerEvents: "none",
        }}
        initial={false}
        animate={{ opacity: caption ? 1 : 0, y: caption ? 96 : 92 }}
        transition={{ duration: reduced ? 0.1 : 0.18 }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-color-disabled)",
            whiteSpace: "nowrap",
          }}
        >
          {caption ?? " "}
        </p>
      </motion.div>

      <AnimatePresence>
        {action && (
          <motion.button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="ring-focus"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // Needs its own transition, or `action.delay` applies on the way
            // out too and the button lingers over the returning cells.
            exit={{ opacity: 0, transition: { duration: 0.12, delay: 0 } }}
            transition={{
              delay: action.delay(reduced),
              duration: 0.3,
            }}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              translate: "-50% -50%",
              // Steps down out of the caption's way when one is showing.
              transform: `translateY(${
                caption ? RESET_BUTTON_OFFSET + 44 : RESET_BUTTON_OFFSET
              }px)`,
              transition: "transform 200ms ease-out",
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--background)",
              fontSize: 13,
              fontWeight: 500,
              color: action.primary
                ? "var(--text-color-1)"
                : "var(--text-color-disabled)",
              cursor: "pointer",
            }}
          >
            {action.label}
          </motion.button>
        )}
      </AnimatePresence>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {announcement(state)}
      </div>
    </div>
  );
}
