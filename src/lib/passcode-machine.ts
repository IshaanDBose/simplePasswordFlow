/**
 * The passcode flow as an explicit finite state machine.
 *
 * Keeping the machine as a plain reducer (rather than hiding it inside the
 * component) is what lets the left-hand panel both *drive* the flow and
 * *visualise* it: scenarios dispatch the exact same events a keystroke does.
 *
 *   idle ──digit──▶ filling ──4th digit──▶ complete ──320ms | Enter──▶ submitting
 *     ▲                 │                      │                          │
 *     │                 ◀──── backspace ───────┘              ┌───────────┴──────────┐
 *     │                                                    success                 error
 *     └───────────────────── clear (850ms) ◀──────────────────────────────────────────┘
 */

export const CODE_LENGTH = 4;
export const CORRECT_CODE = "1234";
export const HINT_AFTER_ATTEMPTS = 3;

/** Timings, in ms. Collected here so the whole feel can be tuned in one place. */
export const TIMING = {
  /** Beat between the last digit landing and submission — long enough to see
   *  the digit settle, short enough to still feel automatic. */
  autoSubmit: 320,
  /** Simulated network round-trip. */
  verify: 1600,
  /** How long the error state holds before clearing itself for a retry. */
  errorHold: 900,
} as const;

export type Status =
  | "idle"
  | "filling"
  | "complete"
  | "submitting"
  | "success"
  | "error";

export const STATUS_ORDER: Status[] = [
  "idle",
  "filling",
  "complete",
  "submitting",
  "success",
  "error",
];

export type InputKind = "key" | "paste";

export interface PasscodeState {
  status: Status;
  /** 0–4 digits. Always contiguous, which is why a plain string models it. */
  code: string;
  attempts: number;
  focused: boolean;
  /** Bumped whenever input is refused; drives the wiggle. */
  rejections: number;
  /** Bumped whenever a submission fails; drives the shake. */
  failures: number;
  /** Transient line under the cells. */
  caption: string | null;
  /** How the most recent digits arrived — paste enters with a stagger. */
  lastInputKind: InputKind;
  /** When set, automatic transitions pause on this status so it can be
   *  inspected. Cleared by any real interaction. */
  holdAt: Status | null;
}

export const initialState: PasscodeState = {
  status: "idle",
  code: "",
  attempts: 0,
  focused: false,
  rejections: 0,
  failures: 0,
  caption: null,
  lastInputKind: "key",
  holdAt: null,
};

export type PasscodeEvent =
  | { type: "FOCUS" }
  | { type: "BLUR" }
  | { type: "KEY_DIGIT"; digit: string }
  | { type: "KEY_BACKSPACE" }
  | { type: "PASTE"; value: string }
  /** Fallback path for mobile autofill / one-time-code injection. */
  | { type: "AUTOFILL"; value: string }
  | { type: "REJECT"; reason: string }
  | { type: "SUBMIT" }
  | { type: "RESOLVE" }
  | { type: "FAIL" }
  /** Soft reset: empties the code, keeps the attempt history. */
  | { type: "CLEAR" }
  /** Hard reset: back to a pristine machine. */
  | { type: "RESET" }
  | { type: "HOLD_AT"; status: Status | null }
  | { type: "SEED_ATTEMPTS"; attempts: number };

const EDITABLE: readonly Status[] = ["idle", "filling", "complete"];

export const isEditable = (status: Status) => EDITABLE.includes(status);

export const sanitize = (raw: string) =>
  raw.replace(/\D/g, "").slice(0, CODE_LENGTH);

export const statusForCode = (code: string): Status => {
  if (code.length === 0) return "idle";
  if (code.length === CODE_LENGTH) return "complete";
  return "filling";
};

/**
 * The cell wearing the highlight ring.
 *
 * The ring trails the cursor: it sits on the digit you just typed rather than
 * on the next empty cell. That is what the Figma "filling in numbers" frame
 * shows (1-2-2 with the *third*, filled, cell ringed) and it reads as a
 * carriage that advances when the next key lands.
 */
export const ringIndex = (code: string) =>
  code.length === 0 ? 0 : Math.min(code.length - 1, CODE_LENGTH - 1);

/** Where the next digit will land. */
export const cursorIndex = (code: string) =>
  Math.min(code.length, CODE_LENGTH - 1);

/**
 * `holdAt` is only ever changed by an explicit HOLD_AT event — the hook clears
 * it the moment a real interaction arrives. Keeping it out of every other case
 * means a scenario's freeze survives the events the scenario itself dispatches.
 */
function accept(
  state: PasscodeState,
  code: string,
  kind: InputKind,
): PasscodeState {
  return {
    ...state,
    code,
    status: statusForCode(code),
    caption: null,
    lastInputKind: kind,
  };
}

export function reducer(
  state: PasscodeState,
  event: PasscodeEvent,
): PasscodeState {
  switch (event.type) {
    case "FOCUS":
      return state.focused ? state : { ...state, focused: true };

    case "BLUR":
      return state.focused ? { ...state, focused: false } : state;

    case "KEY_DIGIT": {
      // Nothing gets through while the code is in flight.
      if (state.status === "submitting") return state;
      // Typing after a verdict starts a fresh entry rather than appending.
      if (!isEditable(state.status)) {
        return accept(state, event.digit, "key");
      }
      // Full and waiting to submit — extra digits are ignored, not punished.
      if (state.code.length >= CODE_LENGTH) return state;
      return accept(state, state.code + event.digit, "key");
    }

    case "KEY_BACKSPACE": {
      if (state.status === "submitting") return state;
      if (!isEditable(state.status)) return accept(state, "", "key");
      if (state.code.length === 0) return state;
      return accept(state, state.code.slice(0, -1), "key");
    }

    case "PASTE": {
      if (state.status === "submitting") return state;
      // Non-digits are stripped silently — no scolding for pasting from an
      // email that carried a stray space or dash.
      return accept(state, sanitize(event.value), "paste");
    }

    case "AUTOFILL": {
      if (state.status === "submitting") return state;
      const code = sanitize(event.value);
      if (code === state.code) return state;
      return accept(state, code, "paste");
    }

    case "REJECT":
      return {
        ...state,
        rejections: state.rejections + 1,
        caption: event.reason,
      };

    case "SUBMIT": {
      if (!isEditable(state.status)) return state;
      if (state.code.length < CODE_LENGTH) {
        return {
          ...state,
          rejections: state.rejections + 1,
          caption: `Enter all ${CODE_LENGTH} digits`,
        };
      }
      return { ...state, status: "submitting", caption: null };
    }

    case "RESOLVE":
      if (state.status !== "submitting") return state;
      return { ...state, status: "success", caption: null };

    case "FAIL": {
      if (state.status !== "submitting") return state;
      const attempts = state.attempts + 1;
      return {
        ...state,
        status: "error",
        attempts,
        failures: state.failures + 1,
        caption:
          attempts >= HINT_AFTER_ATTEMPTS ? `Hint: the code is ${CORRECT_CODE}` : null,
      };
    }

    case "CLEAR":
      return {
        ...state,
        status: "idle",
        code: "",
        lastInputKind: "key",
        // The hint, once earned, stays until the flow resets.
        caption:
          state.attempts >= HINT_AFTER_ATTEMPTS
            ? `Hint: the code is ${CORRECT_CODE}`
            : null,
      };

    case "RESET":
      // Preserves focus and any scenario freeze; everything else goes back.
      return { ...initialState, focused: state.focused, holdAt: state.holdAt };

    case "HOLD_AT":
      return { ...state, holdAt: event.status };

    case "SEED_ATTEMPTS":
      return { ...state, attempts: event.attempts };

    default:
      return state;
  }
}

/** Human-readable label for the live readout and the panel. */
export const STATUS_LABEL: Record<Status, string> = {
  idle: "idle",
  filling: "filling",
  complete: "complete",
  submitting: "submitting",
  success: "success",
  error: "error",
};

/** Announcement copy for the aria-live region. */
export function announcement(state: PasscodeState): string {
  switch (state.status) {
    case "submitting":
      return "Verifying passcode";
    case "success":
      return "Authenticated";
    case "error":
      return "Incorrect passcode. Cleared, try again.";
    case "complete":
      return `All ${CODE_LENGTH} digits entered`;
    case "filling":
      return `${state.code.length} of ${CODE_LENGTH} digits entered`;
    default:
      return "Passcode empty";
  }
}
