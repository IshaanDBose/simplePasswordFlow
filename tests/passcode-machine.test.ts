import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CODE_LENGTH,
  CORRECT_CODE,
  HINT_AFTER_ATTEMPTS,
  initialState,
  reducer,
  ringIndex,
  sanitize,
  type PasscodeEvent,
  type PasscodeState,
} from "../src/lib/passcode-machine";

/** Apply a run of events to the initial state. */
const run = (
  events: PasscodeEvent[],
  from: PasscodeState = initialState,
): PasscodeState => events.reduce(reducer, from);

const type = (value: string): PasscodeEvent[] =>
  value.split("").map((digit) => ({ type: "KEY_DIGIT", digit }));

const back = (n = 1): PasscodeEvent[] =>
  Array.from({ length: n }, () => ({ type: "KEY_BACKSPACE" }) as const);

test("only digits are accepted", () => {
  assert.equal(sanitize("a1-b2 c3d4"), "1234");
  assert.equal(sanitize("....."), "");
  // A long paste is truncated rather than rejected.
  assert.equal(sanitize("123456789"), "1234");
});

test("typing advances through filling and lands on complete", () => {
  assert.equal(run(type("1")).status, "filling");
  assert.equal(run(type("123")).status, "filling");

  const full = run(type("1234"));
  assert.equal(full.status, "complete");
  assert.equal(full.code, "1234");
});

test("the ring trails the cursor, matching the Figma filling frame", () => {
  // 1-2-2 highlights the third cell (index 2), not the next empty one.
  assert.equal(ringIndex("122"), 2);
  assert.equal(ringIndex(""), 0);
  assert.equal(ringIndex("1234"), CODE_LENGTH - 1);
});

test("extra digits past the fourth are ignored, not punished", () => {
  const state = run([...type("1234"), ...type("99")]);
  assert.equal(state.code, "1234");
  assert.equal(state.rejections, 0, "no wiggle for overtyping a full code");
});

test("backspace clears the last digit and walks backwards", () => {
  assert.equal(run([...type("1234"), ...back()]).code, "123");
  assert.equal(run([...type("1234"), ...back(4)]).code, "");
  // Held backspace on an empty field is a no-op, never an error.
  const empty = run([...type("12"), ...back(6)]);
  assert.equal(empty.code, "");
  assert.equal(empty.status, "idle");
  assert.equal(empty.rejections, 0);
});

test("a refused key wiggles and explains, leaving the code untouched", () => {
  const state = run([
    ...type("12"),
    { type: "REJECT", reason: "Numbers only" },
  ]);
  assert.equal(state.code, "12");
  assert.equal(state.rejections, 1);
  assert.equal(state.caption, "Numbers only");
  // The next real digit clears the complaint.
  assert.equal(reducer(state, { type: "KEY_DIGIT", digit: "3" }).caption, null);
});

test("submitting a short code is refused with a reason", () => {
  const state = run([...type("12"), { type: "SUBMIT" }]);
  assert.equal(state.status, "filling", "stays put rather than submitting");
  assert.equal(state.caption, `Enter all ${CODE_LENGTH} digits`);
  assert.equal(state.rejections, 1);
});

test("the correct code authenticates", () => {
  const state = run([...type(CORRECT_CODE), { type: "SUBMIT" }]);
  assert.equal(state.status, "submitting");
  assert.equal(reducer(state, { type: "RESOLVE" }).status, "success");
});

test("a wrong code fails, shakes, and counts the attempt", () => {
  const failed = run([
    ...type("1235"),
    { type: "SUBMIT" },
    { type: "FAIL" },
  ]);
  assert.equal(failed.status, "error");
  assert.equal(failed.attempts, 1);
  assert.equal(failed.failures, 1);

  // Clearing readies a retry without forgetting the attempt history.
  const cleared = reducer(failed, { type: "CLEAR" });
  assert.equal(cleared.code, "");
  assert.equal(cleared.status, "idle");
  assert.equal(cleared.attempts, 1);
});

test("the hint appears only once someone is genuinely stuck", () => {
  let state = initialState;
  for (let i = 0; i < HINT_AFTER_ATTEMPTS; i++) {
    state = run(
      [...type("9999"), { type: "SUBMIT" }, { type: "FAIL" }],
      state,
    );
    const isLast = i === HINT_AFTER_ATTEMPTS - 1;
    assert.equal(
      state.caption?.includes(CORRECT_CODE) ?? false,
      isLast,
      `hint on attempt ${i + 1}`,
    );
    state = reducer(state, { type: "CLEAR" });
  }
  // It survives the clear, so it is still on screen for the next try.
  assert.match(state.caption ?? "", new RegExp(CORRECT_CODE));
});

test("nothing gets through while the code is in flight", () => {
  const inFlight = run([...type("1234"), { type: "SUBMIT" }]);
  assert.equal(reducer(inFlight, { type: "KEY_DIGIT", digit: "9" }), inFlight);
  assert.equal(reducer(inFlight, { type: "KEY_BACKSPACE" }), inFlight);
  assert.equal(
    reducer(inFlight, { type: "PASTE", value: "0000" }),
    inFlight,
  );
});

test("typing after a verdict starts a fresh entry", () => {
  const done = run([...type("1234"), { type: "SUBMIT" }, { type: "RESOLVE" }]);
  const restarted = reducer(done, { type: "KEY_DIGIT", digit: "9" });
  assert.equal(restarted.code, "9", "does not append to the old code");
  assert.equal(restarted.status, "filling");
});

test("paste replaces the buffer and keeps only digits", () => {
  const state = run([...type("9"), { type: "PASTE", value: "a1-b2 c3d4" }]);
  assert.equal(state.code, "1234");
  assert.equal(state.status, "complete");
  assert.equal(state.lastInputKind, "paste", "so the cells fill in sequence");
  assert.equal(state.rejections, 0, "stripping junk is silent");
});

test("starting over winds the feedback counters back down", () => {
  // The shake and the wiggle are driven off `failures` and `rejections`, so
  // whoever watches them has to react to an *increase* only. RESET drives
  // both to zero, which once made "Start over" shake as though the user had
  // got something wrong.
  const shaken = run([
    ...type("1235"),
    { type: "SUBMIT" },
    { type: "FAIL" },
    { type: "REJECT", reason: "Numbers only" },
  ]);
  assert.equal(shaken.failures, 1);
  assert.equal(shaken.rejections, 1);

  const fresh = reducer(shaken, { type: "RESET" });
  assert.ok(fresh.failures < shaken.failures, "failures must drop on reset");
  assert.ok(fresh.rejections < shaken.rejections, "rejections must drop on reset");
  assert.equal(fresh.attempts, 0);
  assert.equal(fresh.code, "");
  assert.equal(fresh.status, "idle");
});

test("a scenario freeze survives its own scripted events", () => {
  // holdAt must not be cleared by the events the scenario itself dispatches,
  // or the machine races past the state being demonstrated.
  const held = run(
    [
      { type: "HOLD_AT", status: "complete" },
      { type: "RESET" },
      ...type("1234"),
    ],
  );
  assert.equal(held.holdAt, "complete");
  assert.equal(held.status, "complete");
});
