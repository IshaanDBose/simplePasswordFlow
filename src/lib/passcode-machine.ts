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

/**
 * Stands in for the request falling over — a 500, a dropped connection, a
 * timeout. There is no real backend here, so this code is the way to reach
 * that path by hand.
 */
export const UNAVAILABLE_CODE = "0000";

/** What came back from the (simulated) verification request. */
export type Outcome = "success" | "rejected" | "unavailable";

/**
 * Rejected and unavailable are different answers and must not be collapsed.
 * "We checked, and it was wrong" is about the user; "we could not check" is
 * about us, and telling someone their passcode is incorrect when the server
 * fell over sends them off re-reading a code that was right all along.
 */
export function verifyOutcome(code: string, registered: string): Outcome {
  if (code === UNAVAILABLE_CODE) return "unavailable";
  return code === registered ? "success" : "rejected";
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
 * What the digits being typed are *for*. Kept beside the lifecycle rather than
 * folded into it: entering a code and choosing one move through the same
 * empty → filling → complete progression, and duplicating those three states
 * per intent would double the machine to say the same thing twice.
 */
export type Intent = "verify" | "create";

export const STATUS_ORDER: Status[] = [
  "idle",
  "filling",
  "complete",
  "submitting",
  "success",
  "error",
  "unavailable",
  "created",
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
  /** Whether the digits being typed are being checked or being chosen. */
  intent: Intent;
  /** The passcode that currently opens the door. Replaced by the create flow. */
  registeredCode: string;
  /**
   * A quiet explanation of something the flow did on its own. Lives on the
   * machine rather than beside it so that restoring a draft or reading a
   * linked code stays a single dispatch, with no second source of truth to
   * fall out of step.
   */
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
      registeredCode?: string;
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

/**
 * `unavailable` is editable: the code is still on screen and, as far as anyone
 * knows, still right. Leaving it editable means Enter resubmits it as-is and
 * backspace corrects a digit, rather than forcing a retype for someone else's
 * outage.
 */
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
      /* The chosen code becomes the one that opens the door, and the flow
         drops straight back to verifying so the next thing the user does is
         use it. Attempts reset: the old code's failures are not this one's. */
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
        registeredCode: event.registeredCode ?? state.registeredCode,
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
      /* No attempt is counted and no failure is recorded: the code was never
         judged, so it must not count against a lockout or trip the hint, and
         it must not shake as though the user got something wrong. The code
         stays put so retrying costs nothing. */
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
      /* Preserves focus and any scenario freeze. The registered passcode
         survives too: starting the entry over is not the same as forgetting
         which code was chosen. */
      return {
        ...initialState,
        focused: state.focused,
        holdAt: state.holdAt,
        registeredCode: state.registeredCode,
      };

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
