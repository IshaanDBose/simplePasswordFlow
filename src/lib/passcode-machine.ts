/**
 * The passcode flow as an explicit finite state machine.
 *
 * A plain reducer, so the scenario panel can drive the flow with the same
 * events a keystroke dispatches.
 *
 *   idle ──digit──▶ filling ──4th digit──▶ complete ──320ms | Enter──▶ submitting
 *     ▲                 │                      │                          │
 *     │                 ◀──── backspace ───────┘              ┌───────────┴──────────┐
 *     │                                                    success                 error
 *     └───────────────────── clear (900ms) ◀──────────────────────────────────────────┘
 */

export const CODE_LENGTH = 4;
export const CORRECT_CODE = "1234";
export const HINT_AFTER_ATTEMPTS = 3;

/** There is no backend; entering this code is how the failure path is reached. */
export const UNAVAILABLE_CODE = "0000";

/** What came back from the (simulated) verification request. */
export type Outcome = "success" | "rejected" | "unavailable";

export function verifyOutcome(code: string, registered: string): Outcome {
  // Order matters: 0000 is the outage trigger for every code except one the
  // user actually registered, which would otherwise never sign in.
  if (code === registered) return "success";
  return code === UNAVAILABLE_CODE ? "unavailable" : "rejected";
}

/** Timings, in ms. Collected here so the whole feel can be tuned in one place. */
export const TIMING = {
  /** Beat between the last digit landing and submission — long enough to see
   *  the digit settle, short enough to still feel automatic. */
  autoSubmit: 320,
  /** Simulated network round-trip. */
  verify: 1600,
  /** How long the error state holds before clearing itself for a retry. */
  errorHold: 900,
  /** Long enough to read "Passcode updated" before the field reopens. */
  createdHold: 1400,
} as const;

export type Status =
  | "idle"
  | "filling"
  | "complete"
  | "submitting"
  | "success"
  /** The code was checked and rejected. */
  | "error"
  /** The code could not be checked at all. */
  | "unavailable"
  /** A new passcode has just been registered. */
  | "created";

/**
 * What the digits being typed are for. Orthogonal to `status`, since entering
 * a code and choosing one share the empty → filling → complete progression.
 */
export type Intent = "verify" | "create";

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
  /** Whether the digits being typed are being checked or being chosen. */
  intent: Intent;
  /** The passcode that currently opens the door. Replaced by the create flow. */
  registeredCode: string;
  /** Explains something the flow did on its own (restored a draft, read a link). */
  toast: { id: number; text: string } | null;
  /** Makes repeats of the same message distinguishable, so the toast replays. */
  toastSeq: number;
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
  intent: "verify",
  registeredCode: CORRECT_CODE,
  toast: null,
  toastSeq: 0,
};

/** Copy for the explanations the flow gives about things it did itself. */
export const TOAST = {
  linked: "Code filled from your sign-in link",
  restored: "Picked up where you left off",
  registered: "Passcode saved. Enter it to sign in.",
} as const;

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
  /** The request itself failed — no verdict on the code. */
  | { type: "REQUEST_FAILED" }
  /** Forgot the passcode: start choosing a new one. */
  | { type: "START_CREATE" }
  /** Back out of choosing, without changing anything. */
  | { type: "CANCEL_CREATE" }
  /** Commit the chosen passcode as the one that now opens the door. */
  | { type: "REGISTER" }
  /** Restore a draft entry, a linked code, or a previously chosen passcode. */
  | {
      type: "HYDRATE";
      code?: string;
      holdAt?: Status | null;
      toast?: string;
    }
  | { type: "DISMISS_TOAST" }
  /** Soft reset: empties the code, keeps the attempt history. */
  | { type: "CLEAR" }
  /** Hard reset: back to a pristine machine. */
  | { type: "RESET" }
  | { type: "HOLD_AT"; status: Status | null }
  | { type: "SEED_ATTEMPTS"; attempts: number };

/** `unavailable` is editable so Enter resubmits and backspace corrects, without a retype. */
const EDITABLE: readonly Status[] = [
  "idle",
  "filling",
  "complete",
  "unavailable",
];

export const isEditable = (status: Status) => EDITABLE.includes(status);

export const sanitize = (raw: string) =>
  raw.replace(/\D/g, "").slice(0, CODE_LENGTH);

export const statusForCode = (code: string): Status => {
  if (code.length === 0) return "idle";
  if (code.length === CODE_LENGTH) return "complete";
  return "filling";
};

/**
 * The cell wearing the highlight ring. It trails the cursor, sitting on the
 * digit just typed: the Figma "filling in numbers" frame rings the third
 * (filled) cell of 1-2-2, not the next empty one.
 */
export const ringIndex = (code: string) =>
  code.length === 0 ? 0 : Math.min(code.length - 1, CODE_LENGTH - 1);

/**
 * Leaves `holdAt` alone, so a scenario's freeze survives the events the
 * scenario itself dispatches. Only HOLD_AT changes it.
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
      if (state.status === "submitting") return state;
      // Typing after a verdict starts a fresh entry rather than appending.
      if (!isEditable(state.status)) {
        return accept(state, event.digit, "key");
      }
      // Full and waiting to submit: extra digits are ignored, not refused.
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

    case "START_CREATE":
      return {
        ...state,
        intent: "create",
        status: "idle",
        code: "",
        caption: null,
        lastInputKind: "key",
      };

    case "CANCEL_CREATE":
      return {
        ...state,
        intent: "verify",
        status: "idle",
        code: "",
        caption: null,
        lastInputKind: "key",
      };

    case "REGISTER": {
      if (state.intent !== "create") return state;
      if (state.code.length < CODE_LENGTH) return state;
      // Drops back to verifying with attempts zeroed: the old code's failures
      // are not this one's.
      return {
        ...state,
        status: "created",
        registeredCode: state.code,
        intent: "verify",
        code: "",
        attempts: 0,
        caption: null,
        lastInputKind: "key",
        toast: { id: state.toastSeq + 1, text: TOAST.registered },
        toastSeq: state.toastSeq + 1,
      };
    }

    case "HYDRATE": {
      const code =
        event.code === undefined ? state.code : sanitize(event.code);
      return {
        ...state,
        code,
        status: statusForCode(code),
        holdAt: event.holdAt === undefined ? state.holdAt : event.holdAt,
        lastInputKind: "paste",
        toast: event.toast
          ? { id: state.toastSeq + 1, text: event.toast }
          : state.toast,
        toastSeq: event.toast ? state.toastSeq + 1 : state.toastSeq,
      };
    }

    case "DISMISS_TOAST":
      return state.toast === null ? state : { ...state, toast: null };

    case "REQUEST_FAILED":
      if (state.status !== "submitting") return state;
      // The code was never judged, so it costs no attempt, records no failure,
      // and stays in the field for a retry.
      return { ...state, status: "unavailable", caption: null };

    case "FAIL": {
      if (state.status !== "submitting") return state;
      const attempts = state.attempts + 1;
      return {
        ...state,
        status: "error",
        attempts,
        failures: state.failures + 1,
        caption:
          attempts >= HINT_AFTER_ATTEMPTS
            ? `Hint: the code is ${state.registeredCode}`
            : null,
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
            ? `Hint: the code is ${state.registeredCode}`
            : null,
      };

    case "RESET":
      // Focus, any scenario freeze, and the registered passcode survive.
      return {
        ...initialState,
        focused: state.focused,
        holdAt: state.holdAt,
        registeredCode: state.registeredCode,
      };

    case "HOLD_AT":
      return state.holdAt === event.status
        ? state
        : { ...state, holdAt: event.status };

    case "SEED_ATTEMPTS":
      return state.attempts === event.attempts
        ? state
        : { ...state, attempts: event.attempts };

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
  unavailable: "unavailable",
  created: "created",
};

/** Guiding line shown while a new passcode is being chosen. */
export const CREATE_TITLE = "Choose a new passcode";
export const CREATE_SUBTEXT = "Pick 4 digits. You'll use these to sign in.";

/** Announcement copy for the aria-live region. */
export function announcement(state: PasscodeState): string {
  if (state.intent === "create" && isEditable(state.status)) {
    return state.code.length === 0
      ? `${CREATE_TITLE}. ${CREATE_SUBTEXT}`
      : `${state.code.length} of ${CODE_LENGTH} digits chosen`;
  }
  switch (state.status) {
    case "submitting":
      return "Verifying passcode";
    case "success":
      return "Authenticated";
    case "error":
      return "Incorrect passcode. Cleared, try again.";
    case "unavailable":
      return "Could not verify the passcode. Your code is still entered. Press Enter to try again.";
    case "created":
      return "New passcode saved. Enter it to continue.";
    case "complete":
      return `All ${CODE_LENGTH} digits entered`;
    case "filling":
      return `${state.code.length} of ${CODE_LENGTH} digits entered`;
    default:
      return "Passcode empty";
  }
}
