"use client";

import { useEffect, useRef } from "react";
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
 * Vertical offset of the status row while the cells are on screen.
 *
 * Figma puts the header's centre at y=394. Its empty and filling frames put
 * the cells at y=427 (centre 491) but the submit frame at y=426 — a 1px
 * disagreement between the source frames. The cells are the anchor here:
 * pinning them to the true centre keeps them from twitching when verification
 * starts, and -97 then lands the header on 394 exactly as drawn.
 *
 * On success the cells leave and this row travels down into the centre, which
 * is where the authenticated frame draws it.
 */
const ROW_OFFSET = -97;

const GROUP_W = CELL_W * CODE_LENGTH;

/** Breathing room kept around the group on small screens. */
const MIN_GUTTER = 16;

/**
 * Vertical span the stage needs: the status row sits 113px above centre and
 * the retry/reset button reaches 121px below it. Counted so that a short
 * viewport — 200% zoom halves the height as well as the width — scales the
 * stage down rather than clipping the button off the bottom.
 */
const STAGE_H = 260;

const SPRING = { type: "spring" as const, stiffness: 440, damping: 34, mass: 0.9 };

/** Radius of the ring's own corners, in px. */
const RING_RADIUS = 4;

/**
 * Success is a handoff, not a crossfade, so the two halves take turns:
 * the cells acknowledge and clear first, and only then does the status row
 * travel down into the centre. Overlapping them put a descending row on top
 * of still-opaque cells, with the cells drifting up against it.
 *
 *   0.00  spinner swaps to the check, green ripples across the cells
 *   0.16  cells fade and settle back in place (no vertical drift to fight)
 *   0.34  row begins its descent, arriving on an empty stage
 */
const CELLS_EXIT_DELAY = 0.16;
const ROW_DESCENT_DELAY = 0.34;

/**
 * Coming back the other way — success to empty — the group has to wait for
 * the old digits to leave before it fades in, or it fades up around them and
 * the finished code flashes on screen on its way out. Comfortably longer than
 * a digit's 0.16s exit.
 */
const DIGITS_CLEAR_DELAY = 0.2;

/**
 * Hiding the status row repositions it for next time. That has to happen
 * after it has faded, otherwise it flies 100px up the screen on its way out.
 */
const ROW_FADE = 0.2;

/**
 * Centre offset of the "Start over" button.
 *
 * At 72 its top sat 9px inside the cells' bottom edge, so it clipped the
 * passcode as that came back. 104 puts its top level with the caption slot —
 * both secondary elements start the same 23px below the cells — which clears
 * the group and lands on an alignment that already exists rather than an
 * arbitrary nudge.
 */
const RESET_BUTTON_OFFSET = 104;

/**
 * The ring sits on the same box as the cell it highlights, so on the two end
 * cells its outer corners have to pick up the group's 16px radius — otherwise
 * a 4px corner cuts across the rounded edge behind it. Returned as the four
 * corner longhands so they can be animated individually as the ring slides.
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
  // `unavailable` keeps the default palette on purpose: nothing is wrong with
  // what was typed, so marking the cells would be a lie. The status row
  // carries the message.
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
  /* While a new passcode is being chosen the guiding line takes the status
     row's place, and the subtext takes the caption's. */
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

  /* The offer to reset a forgotten passcode, once there is a reason to think
     it has been forgotten. It outlives the error state itself, which clears
     after 900ms — one glimpse of a link is not an escape route. */
  const showForgot =
    intent === "verify" &&
    state.attempts > 0 &&
    isEditable(status) &&
    status !== "created";

  /* A wrong code shakes the whole group; a refused key gives it a much
     smaller nudge. Same gesture, different conviction.
     Both fire only when their counter goes *up*. Starting over zeroes them,
     and a reset is not something to apologise for — reacting to any change
     made "Start over" shake as though the user had got something wrong. */
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

  /*
   * One button slot, four jobs. Whichever way the flow has come to rest,
   * there is exactly one thing worth offering, so they share a position
   * rather than competing for the space under the cells.
   */
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
            // An afterthought, offered a beat later so it does not crowd
            // the moment it follows.
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

  /* The group is a fixed 336px wide, which is wider than a small phone once
     you allow for gutters. Scaling the whole stage keeps the proportions and
     the -97px handoff intact; it only ever scales down, so the desktop layout
     stays pixel-exact. */
  const stageRef = useRef<HTMLDivElement>(null);

  /*
   * Written straight to a CSS variable rather than held in React state: the
   * scale is a fact about the DOM, so syncing it to the DOM needs no re-render
   * and nothing downstream has to wait on one.
   *
   * Measured immediately as well as observed. A ResizeObserver only reports
   * once it has a frame to report against, which leaves the first paint
   * unscaled; and the panel opening changes the stage's width without the
   * window resizing, so all three triggers earn their place.
   */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const apply = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const scale = Math.min(
        1,
        (width - MIN_GUTTER * 2) / GROUP_W,
        (height - MIN_GUTTER * 2) / STAGE_H,
      );
      el.style.setProperty("--stage-scale", String(Math.max(scale, 0.2)));
    };

    apply();
    window.addEventListener("resize", apply);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(el);
    return () => {
      window.removeEventListener("resize", apply);
      observer?.disconnect();
    };
  });

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
                  // Descending into the centre waits for the cells to clear.
                  // Leaving waits for the fade, so the row dissolves where it
                  // stands instead of streaking back up to its start position.
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
        {/* No icon while choosing — a guiding line does not need a badge. */}
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
              {/* Says what we know — that we don't know — instead of
                  blaming a passcode nobody has actually checked. */}
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
          // Settles back in place rather than drifting up, which used to run
          // head-on into the status row coming down.
          scale: showCells ? 1 : 0.96,
        }}
        transition={{
          duration: reduced ? 0.15 : 0.22,
          ease: "easeOut",
          delay: reduced
            ? 0
            : showCells
              ? // Fading back in: hold until the old digits have gone, so the
                // finished code does not flash as the group reappears.
                DIGITS_CLEAR_DELAY
              : // Fading out: long enough for the green acknowledgement first.
                CELLS_EXIT_DELAY,
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

          {/* Highlight ring — one element that slides, rather than four that
              blink on and off. */}
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
              // Corners resolve a touch quicker than the slide, so the ring
              // has squared off before it reaches a middle cell.
              borderTopLeftRadius: { duration: reduced ? 0 : 0.18 },
              borderBottomLeftRadius: { duration: reduced ? 0 : 0.18 },
              borderTopRightRadius: { duration: reduced ? 0 : 0.18 },
              borderBottomRightRadius: { duration: reduced ? 0 : 0.18 },
            }}
          />

          {/*
            One real input drives everything above. Keeping it native buys
            paste, key repeat on backspace, the numeric keyboard on mobile and
            one-time-code autofill for free.
          */}
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
            // Deliberately not `disabled`: the machine already ignores input
            // while verifying, and staying focusable means the ring comes
            // straight back after a failure without another click.
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

      {/* Transient caption: refusals, and the hint once someone is stuck. */}
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

      {/*
        A way out of whichever state the flow has come to rest in. After
        success it is an afterthought, offered a beat later so it does not
        crowd the moment. After a failed request it is the whole point, so it
        arrives immediately.
      */}
      <AnimatePresence>
        {action && (
          <motion.button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="ring-focus"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // Its own transition, or the offer-it-late delay below applies on
            // the way out too and the button hangs around for a second over
            // the cells coming back.
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
              // Steps down out of the caption's way when one is showing, so
              // the hint and the action never share the same band.
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
              // The action being asked for carries full ink; the ones that
              // are merely available stay quiet.
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
