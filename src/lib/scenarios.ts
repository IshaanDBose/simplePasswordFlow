import { UNAVAILABLE_CODE, type PasscodeEvent, type Status } from "./passcode-machine";

/**
 * Scripted walkthroughs for the state panel.
 *
 * Every step dispatches the same events a real keystroke would, so a scenario
 * cannot drift from the real behaviour — there is no second code path.
 * `holdAt` freezes the machine's automatic transitions once it reaches that
 * status, so a state can be inspected instead of racing past.
 */

export type ScenarioGroup = "States" | "Edge cases";

export interface ScenarioStep {
  /** Offset from the start of playback, in ms. */
  at: number;
  event: PasscodeEvent;
}

export interface Scenario {
  id: string;
  group: ScenarioGroup;
  label: string;
  /** Plain-English gloss of what the state means, shown under the label. */
  subtitle: string;
  /** One line explaining what this state is, shown under the active item. */
  blurb: string;
  /** Whether the field should hold DOM focus during this scenario. */
  focus: "on" | "off";
  steps: ScenarioStep[];
  /** Status the machine settles on, used for the live highlight. */
  settlesOn: Status;
  /** Pause automatic transitions once this status is reached. */
  holdAt: Status | null;
  /** Marks the three frames that exist in the Figma file. */
  inFigma?: boolean;
}

const digits = (value: string, from = 0, gap = 190): ScenarioStep[] =>
  value.split("").map((digit, i) => ({
    at: from + i * gap,
    event: { type: "KEY_DIGIT", digit } as PasscodeEvent,
  }));

export const SCENARIOS: Scenario[] = [
  {
    id: "empty",
    group: "States",
    label: "Empty",
    subtitle: "Nothing typed yet",
    blurb: "Resting state. No ring until the field takes focus.",
    focus: "off",
    steps: [{ at: 0, event: { type: "RESET" } }],
    settlesOn: "idle",
    holdAt: "idle",
    inFigma: true,
  },
  {
    id: "filling",
    group: "States",
    label: "Filling in numbers",
    subtitle: "Some digits in, not all four",
    blurb: "The ring trails the cursor, resting on the digit just typed.",
    focus: "on",
    steps: [{ at: 0, event: { type: "RESET" } }, ...digits("122", 220)],
    settlesOn: "filling",
    holdAt: "filling",
    inFigma: true,
  },
  {
    id: "complete",
    group: "States",
    label: "Complete",
    subtitle: "Four digits in, about to send",
    blurb: "All four in. Held here — live, this submits itself after 320ms.",
    focus: "on",
    steps: [{ at: 0, event: { type: "RESET" } }, ...digits("1234", 220)],
    settlesOn: "complete",
    holdAt: "complete",
  },
  {
    id: "submitting",
    group: "States",
    label: "Verifying",
    subtitle: "Code sent, waiting for an answer",
    blurb: "Cells go quiet and lock while the code is in flight.",
    focus: "on",
    steps: [{ at: 0, event: { type: "RESET" } }, ...digits("1234", 160, 110)],
    settlesOn: "submitting",
    holdAt: "submitting",
    inFigma: true,
  },
  {
    id: "success",
    group: "States",
    label: "Authenticated",
    subtitle: "The code was right",
    blurb: "Cells hand off to the confirmation, which settles into centre.",
    focus: "on",
    steps: [{ at: 0, event: { type: "RESET" } }, ...digits("1234", 160, 110)],
    settlesOn: "success",
    holdAt: "success",
    inFigma: true,
  },
  {
    id: "error",
    group: "States",
    label: "Incorrect",
    subtitle: "The code was wrong",
    blurb: "Not in Figma — extends the system with the same anatomy in red.",
    focus: "on",
    steps: [{ at: 0, event: { type: "RESET" } }, ...digits("1235", 160, 110)],
    settlesOn: "error",
    holdAt: "error",
  },
  {
    id: "unavailable",
    group: "States",
    label: "Couldn't verify",
    subtitle: "The check failed, not the code",
    blurb:
      "The request failed, not the code. Nothing is cleared and no attempt is counted.",
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      ...digits(UNAVAILABLE_CODE, 160, 110),
    ],
    settlesOn: "unavailable",
    holdAt: "unavailable",
  },

  {
    id: "creating",
    group: "States",
    label: "Choosing a new one",
    subtitle: "Setting a code, not entering one",
    blurb: "Reached from 'Forgot passcode?'. Same cells, different question.",
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      { at: 120, event: { type: "START_CREATE" } },
      ...digits("43", 380),
    ],
    settlesOn: "filling",
    holdAt: "filling",
  },

  {
    id: "paste",
    group: "Edge cases",
    label: "Paste a code",
    subtitle: "Four digits arrive at once",
    blurb: "Four digits land at once, staggered so the fill reads left to right.",
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      { at: 320, event: { type: "PASTE", value: "1234" } },
    ],
    settlesOn: "complete",
    holdAt: "complete",
  },
  {
    id: "paste-junk",
    group: "Edge cases",
    label: "Paste with junk",
    subtitle: "Pasted text carrying extra characters",
    blurb: '"a1-b2 c3d4" is stripped to its digits. No scolding.',
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      { at: 320, event: { type: "PASTE", value: "a1-b2 c3d4" } },
    ],
    settlesOn: "complete",
    holdAt: "complete",
  },
  {
    id: "non-numeric",
    group: "Edge cases",
    label: "Non-numeric key",
    subtitle: "A key that isn't a number",
    blurb: "Letters are refused with a wiggle — feedback, not punishment.",
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      ...digits("12", 220),
      { at: 780, event: { type: "REJECT", reason: "Numbers only" } },
      { at: 1240, event: { type: "REJECT", reason: "Numbers only" } },
    ],
    settlesOn: "filling",
    holdAt: "filling",
  },
  {
    id: "backspace-hold",
    group: "Edge cases",
    label: "Hold backspace",
    subtitle: "Backspace held down, repeating",
    blurb: "Key repeat cascades back through the cells, one per tick.",
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      ...digits("1234", 180, 110),
      { at: 900, event: { type: "KEY_BACKSPACE" } },
      { at: 1000, event: { type: "KEY_BACKSPACE" } },
      { at: 1100, event: { type: "KEY_BACKSPACE" } },
      { at: 1200, event: { type: "KEY_BACKSPACE" } },
    ],
    settlesOn: "idle",
    holdAt: "idle",
  },
  {
    id: "incomplete-submit",
    group: "Edge cases",
    label: "Submit while short",
    subtitle: "Enter pressed before the code is full",
    blurb: "Enter on a partial code refuses and says what is missing.",
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      ...digits("12", 220),
      { at: 800, event: { type: "SUBMIT" } },
    ],
    settlesOn: "filling",
    holdAt: "filling",
  },
  {
    id: "retry-after-failure",
    group: "Edge cases",
    label: "Retry after a failure",
    subtitle: "Sending the same code again",
    blurb: "Enter resends what is already there — an outage costs no retyping.",
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      ...digits(UNAVAILABLE_CODE, 160, 110),
      // Waits out the request, then resubmits the code still sitting there.
      { at: 2400, event: { type: "SUBMIT" } },
    ],
    settlesOn: "unavailable",
    holdAt: "unavailable",
  },
  {
    id: "forgot-flow",
    group: "Edge cases",
    label: "Forgot, then reset it",
    subtitle: "Replacing a passcode you can't recall",
    blurb: "Wrong code, choose 4321, and that becomes the code that works.",
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      { at: 60, event: { type: "SEED_ATTEMPTS", attempts: 1 } },
      { at: 120, event: { type: "START_CREATE" } },
      ...digits("4321", 400, 150),
      { at: 1100, event: { type: "REGISTER" } },
    ],
    settlesOn: "created",
    holdAt: "created",
  },
  {
    id: "third-attempt",
    group: "Edge cases",
    label: "Third wrong attempt",
    subtitle: "Failures adding up, needs a way out",
    blurb: "Two failures already logged. The third offers a way out.",
    focus: "on",
    steps: [
      { at: 0, event: { type: "RESET" } },
      { at: 0, event: { type: "SEED_ATTEMPTS", attempts: 2 } },
      ...digits("9999", 160, 110),
    ],
    settlesOn: "error",
    holdAt: "error",
  },
];

export const SCENARIO_GROUPS: ScenarioGroup[] = ["States", "Edge cases"];

export const KEY_MAP: { keys: string; does: string }[] = [
  { keys: "0 – 9", does: "Enter a digit, advance" },
  { keys: "Backspace", does: "Clear the last digit" },
  { keys: "Hold Backspace", does: "Cascade backwards" },
  { keys: "Enter", does: "Submit" },
  { keys: "⌘V", does: "Paste, digits only" },
  { keys: "Esc", does: "Start over" },
  { keys: "⌘\\", does: "Show or hide this panel" },
];
