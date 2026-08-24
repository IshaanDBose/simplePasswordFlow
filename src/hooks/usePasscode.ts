"use client";

import { useCallback, useEffect, useMemo, useRef, useReducer, useState } from "react";
import {
  CODE_LENGTH,
  CORRECT_CODE,
  TIMING,
  initialState,
  isEditable,
  reducer,
  type PasscodeEvent,
} from "@/lib/passcode-machine";
import type { Scenario } from "@/lib/scenarios";

/**
 * Wires the passcode machine to real time: the automatic transitions, the
 * simulated verification round-trip, and scenario playback.
 */
export function usePasscode() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancelScenario = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlayingId(null);
  }, []);

  /* Automatic transitions.
     Suppressed entirely while a scenario is mid-playback (its scripted steps
     own the timeline), then frozen on the scenario's `holdAt` status so the
     state can be looked at rather than raced past. */
  useEffect(() => {
    if (playingId !== null) return;
    if (state.holdAt === state.status) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (state.status === "complete") {
      timer = setTimeout(
        () => dispatch({ type: "SUBMIT" }),
        TIMING.autoSubmit,
      );
    } else if (state.status === "submitting") {
      timer = setTimeout(
        () =>
          dispatch({
            type: state.code === CORRECT_CODE ? "RESOLVE" : "FAIL",
          }),
        TIMING.verify,
      );
    } else if (state.status === "error") {
      timer = setTimeout(() => dispatch({ type: "CLEAR" }), TIMING.errorHold);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [state.status, state.holdAt, state.code, playingId]);

  /** Any real interaction takes the flow off scenario rails. */
  const interact = useCallback(
    (event: PasscodeEvent) => {
      cancelScenario();
      dispatch({ type: "HOLD_AT", status: null });
      dispatch(event);
    },
    [cancelScenario],
  );

  const play = useCallback(
    (scenario: Scenario) => {
      cancelScenario();
      setPlayingId(scenario.id);

      dispatch({ type: "HOLD_AT", status: scenario.holdAt });

      if (scenario.focus === "on") inputRef.current?.focus();
      else inputRef.current?.blur();

      const last = scenario.steps.reduce((max, s) => Math.max(max, s.at), 0);

      scenario.steps.forEach((step) => {
        timers.current.push(setTimeout(() => dispatch(step.event), step.at));
      });

      // Once the script is done the machine's own timers take over and carry
      // it the rest of the way (complete → submitting → success/error).
      timers.current.push(setTimeout(() => setPlayingId(null), last + 60));
    },
    [cancelScenario],
  );

  /* Typing anywhere on the page focuses the field. This keeps the empty state
     exactly as drawn (no ring) until the user actually does something, while
     still letting a keyboard user start without hunting for the input. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.activeElement === inputRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!/^[0-9]$/.test(e.key)) return;
      e.preventDefault();
      inputRef.current?.focus();
      interact({ type: "KEY_DIGIT", digit: e.key });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interact]);

  useEffect(() => cancelScenario, [cancelScenario]);

  const handlers = useMemo(
    () => ({
      onFocus: () => dispatch({ type: "FOCUS" }),
      onBlur: () => dispatch({ type: "BLUR" }),

      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return; // leave ⌘V etc. alone
        if (e.key === "Tab") return;

        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          interact({ type: "KEY_DIGIT", digit: e.key });
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          interact({ type: "KEY_BACKSPACE" });
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          interact({ type: "SUBMIT" });
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          interact({ type: "RESET" });
          return;
        }
        // Pin the native caret: arrows would desync it from our model.
        if (
          e.key.startsWith("Arrow") ||
          e.key === "Home" ||
          e.key === "End"
        ) {
          e.preventDefault();
          return;
        }
        // Any other single printable character is a refusal.
        if (e.key.length === 1) {
          e.preventDefault();
          interact({ type: "REJECT", reason: "Numbers only" });
        }
      },

      onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        interact({
          type: "PASTE",
          value: e.clipboardData.getData("text").slice(0, 32),
        });
      },

      // Mobile keyboards and one-time-code autofill bypass keydown.
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        interact({ type: "AUTOFILL", value: e.target.value });
      },

      // Keep the invisible caret parked at the end at all times.
      onSelect: (e: React.SyntheticEvent<HTMLInputElement>) => {
        const el = e.currentTarget;
        const end = el.value.length;
        if (el.selectionStart !== end || el.selectionEnd !== end) {
          el.setSelectionRange(end, end);
        }
      },
    }),
    [interact],
  );

  const focusField = useCallback(() => {
    // Touch devices: do not yank up the keyboard on load or on panel clicks.
    inputRef.current?.focus();
  }, []);

  return {
    state,
    inputRef,
    handlers,
    play,
    playingId,
    focusField,
    reset: () => interact({ type: "RESET" }),
    editable: isEditable(state.status),
    codeLength: CODE_LENGTH,
  };
}
