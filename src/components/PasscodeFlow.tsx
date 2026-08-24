"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { CheckSquare, CrossSquare, Spinner } from "./Icons";
import { CELL_W, CELL_H, PasscodeCell, type Palette } from "./PasscodeCell";
import {
  CODE_LENGTH,
  announcement,
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

const SPRING = { type: "spring" as const, stiffness: 440, damping: 34, mass: 0.9 };

function paletteFor(status: PasscodeState["status"]): Palette {
  if (status === "submitting") return "disabled";
  if (status === "error") return "error";
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
}

export function PasscodeFlow({ state, inputRef, handlers, onReset }: Props) {
  const reduced = useReducedMotion() ?? false;
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const failures = useRef(state.failures);
  const rejections = useRef(state.rejections);

  const { status, code, focused, caption } = state;
  const showCells = status !== "success";
  const rowVisible =
    status === "submitting" || status === "success" || status === "error";
  const rowY = status === "success" ? 0 : ROW_OFFSET;

  /* A wrong code shakes the whole group; a refused key gives it a much
     smaller nudge. Same gesture, different conviction. */
  useEffect(() => {
    if (state.failures === failures.current) return;
    failures.current = state.failures;
    if (reduced || !scope.current) return;
    animate(
      scope.current,
      { x: [0, -12, 10, -7, 4, 0] },
      { duration: 0.42, ease: "easeInOut" },
    );
  }, [state.failures, animate, reduced, scope]);

  useEffect(() => {
    if (state.rejections === rejections.current) return;
    rejections.current = state.rejections;
    if (reduced || !scope.current) return;
    animate(
      scope.current,
      { x: [0, -5, 4, -2, 0] },
      { duration: 0.22, ease: "easeInOut" },
    );
  }, [state.rejections, animate, reduced, scope]);

  const palette = paletteFor(status);
  const ring = ringIndex(code);
  const ringVisible = focused && showCells && status !== "submitting";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
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
        transition={reduced ? { duration: 0.15 } : SPRING}
        aria-hidden={!rowVisible}
      >
        <div style={{ width: 32, height: 32, position: "relative" }}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={status}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: reduced ? 0.1 : 0.16 }}
              style={{ position: "absolute", inset: 0 }}
            >
              {status === "submitting" && <Spinner />}
              {status === "success" && <CheckSquare draw={!reduced} />}
              {status === "error" && <CrossSquare />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div style={{ position: "relative", height: 29 }}>
          <AnimatePresence initial={false} mode="wait">
            <motion.p
              key={status}
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
              {status === "submitting" && "Verifying..."}
              {status === "success" && "Authenticated"}
              {status === "error" && "Incorrect passcode"}
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
          scale: showCells ? 1 : 0.97,
          y: showCells ? 0 : -6,
        }}
        transition={{
          duration: reduced ? 0.15 : 0.28,
          ease: "easeOut",
          // Let the success wave finish before the group bows out.
          delay: showCells || reduced ? 0 : 0.24,
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
              borderRadius: 4,
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
            }}
            transition={{
              x: reduced ? { duration: 0 } : SPRING,
              opacity: { duration: reduced ? 0 : 0.14 },
              borderColor: { duration: 0.18 },
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

      {/* A way out of the terminal state, offered a beat after it lands. */}
      <AnimatePresence>
        {status === "success" && (
          <motion.button
            type="button"
            onClick={onReset}
            className="ring-focus"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: reduced ? 0.2 : 1.1, duration: 0.3 }}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              translate: "-50% -50%",
              transform: "translateY(72px)",
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--background)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-color-disabled)",
              cursor: "pointer",
            }}
          >
            Start over
          </motion.button>
        )}
      </AnimatePresence>

      <div className="sr-only" role="status" aria-live="polite">
        {announcement(state)}
      </div>
    </div>
  );
}
