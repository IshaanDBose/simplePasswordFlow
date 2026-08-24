"use client";

import { useCallback, useEffect, useMemo, useRef, useReducer, useState } from "react";
import {
  TOAST,
  verifyOutcome,
  TIMING,
  initialState,
  reducer,
  type PasscodeEvent,
} from "@/lib/passcode-machine";
import {
  clearDraft,
  readDraft,
  takeLinkedCode,
  writeDraft,
} from "@/lib/session";
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
  const hydrated = useRef(false);

  /* An effect rather than a lazy reducer initialiser: this page is
     prerendered, and reading storage during render would give the server and
     the client different HTML. The ref keeps StrictMode's double-invoke from
     re-reading (and re-stripping) the linked code. */
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const linked = takeLinkedCode();

    if (linked) {
      // Holding at `complete` suppresses auto-submit, so a magic link fills
      // the field without pressing the button.
      clearDraft();
      dispatch({
        type: "HYDRATE",
        code: linked,
        holdAt: "complete",
        toast: TOAST.linked,
      });
      return;
    }

    const draft = readDraft();
    dispatch({
      type: "HYDRATE",
      code: draft,
      toast: draft ? TOAST.restored : undefined,
    });
  }, []);

  useEffect(() => {
    if (state.intent === "create") return; // a passcode being chosen is not a draft
    writeDraft(state.code);
  }, [state.code, state.intent]);

  /* Toasts dismiss themselves after 5.2s. */
  useEffect(() => {
    if (!state.toast) return;
    const timer = setTimeout(() => dispatch({ type: "DISMISS_TOAST" }), 5200);
    return () => clearTimeout(timer);
  }, [state.toast]);

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
        () =>
          dispatch({
            type: state.intent === "create" ? "REGISTER" : "SUBMIT",
          }),
        TIMING.autoSubmit,
      );
    } else if (state.status === "created") {
      timer = setTimeout(() => dispatch({ type: "CLEAR" }), TIMING.createdHold);
    } else if (state.status === "submitting") {
      timer = setTimeout(() => {
        const outcome = verifyOutcome(state.code, state.registeredCode);
        dispatch({
          type:
            outcome === "success"
              ? "RESOLVE"
              : outcome === "unavailable"
                ? "REQUEST_FAILED"
                : "FAIL",
        });
      }, TIMING.verify);
    } else if (state.status === "error" && state.intent === "verify") {
      timer = setTimeout(() => dispatch({ type: "CLEAR" }), TIMING.errorHold);
    }
    // `unavailable` has no timer: the code stays put until the user retries it.

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    state.status,
    state.holdAt,
    state.code,
    state.intent,
    state.registeredCode,
    playingId,
  ]);

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

      // Released just after the last step so the machine's own timers carry it
      // the rest of the way (complete → submitting → success/error).
      timers.current.push(setTimeout(() => setPlayingId(null), last + 60));
    },
    [cancelScenario],
  );

  /* Typing a digit anywhere on the page focuses the field, so the empty state
     can render unfocused (no ring) without stranding a keyboard user. */
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
    /* Clicking these buttons moves focus to the button, so each hands it back
       to the field. */
    reset: () => {
      interact({ type: "RESET" });
      inputRef.current?.focus();
    },
    retry: () => {
      interact({ type: "SUBMIT" });
      inputRef.current?.focus();
    },
    startCreate: () => {
      clearDraft();
      interact({ type: "START_CREATE" });
      inputRef.current?.focus();
    },
    cancelCreate: () => {
      interact({ type: "CANCEL_CREATE" });
      inputRef.current?.focus();
    },
    toast: state.toast,
    dismissToast: () => dispatch({ type: "DISMISS_TOAST" }),
  };
}
