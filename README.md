# Passcode

A four-digit authentication code entry experience, built as a design engineering take-home.

The app is laid out as a **state machine explorer**. The panel on the left lists every state and edge case; clicking one drives the real component on the right into that state. The passcode itself stays fully interactive the whole time, and the panel highlight follows the machine — type by hand and the highlight moves to whichever state you have arrived at. It reads as a live inspector rather than a menu.

**The code is `1234`.**

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

```bash
npm test
```

Other scripts: `npm run build`, `npm run lint`.

Requires Node 20+.

## Keyboard

| Key | Does |
| --- | --- |
| `0`–`9` | Enter a digit and advance. Works without clicking first — typing anywhere focuses the field |
| `Backspace` / `Delete` | Clear the last digit |
| Hold `Backspace` | Cascade back through the cells on native key repeat |
| `Enter` | Submit |
| `⌘V` | Paste — non-digits are stripped, longer codes truncated |
| `Esc` | Start over |
| `⌘\` | Hide the panel, so the stage is exactly the 1512×982 Figma artboard |

A full code submits itself after a 320ms beat, so `Enter` is there when you want it rather than a toll you pay every time. Verification takes 1.6s.

## How it is built

Next.js (App Router) + TypeScript, Tailwind v4 for the reset and tokens, [Motion](https://motion.dev) for animation, Inter through `next/font`. No backend — verification is a simulated round-trip.

```
src/
  lib/passcode-machine.ts   the flow as a pure reducer
  lib/scenarios.ts          scripted walkthroughs for the panel
  hooks/usePasscode.ts      wires the machine to real time and to the keyboard
  components/               PasscodeFlow, PasscodeCell, StateSidebar, Icons
tests/                      reducer tests covering every rule in the brief
```

### The machine

```
idle ──digit──▶ filling ──4th digit──▶ complete ──320ms | Enter──▶ submitting
  ▲                 │                      │                          │
  │                 ◀──── backspace ───────┘              ┌───────────┴──────────┐
  │                                                    success                 error
  └───────────────────── clear (900ms) ◀──────────────────────────────────────────┘
```

Keeping the flow as a plain reducer rather than burying it in the component is what makes the panel possible: a scenario dispatches the *same events a keystroke does*, so a demo cannot drift from the real behaviour — there is no second code path. A scenario's `holdAt` pauses the machine's automatic transitions once it reaches the state being shown, so you can look at `submitting` instead of watching it race past. Any real interaction lifts the freeze.

### One real input

All four cells are painted over a single native `<input>`. That is the [input-otp](https://input-otp.rodz.dev) approach, and it buys paste handling, key repeat on backspace, the numeric keyboard on mobile, `autocomplete="one-time-code"` autofill, and screen reader support without reimplementing any of it. Digits are handled in `keydown` with `preventDefault`, so the machine is the only thing that can change the value; `onChange` remains as the path for autofill. Arrow keys and Home/End are swallowed to stop the invisible caret drifting out of sync with the model.

## Matching the Figma

Sizes, colours, radii, weights and border structure are taken from the file rather than eyeballed, and verified by measuring the live DOM against it:

- Cells are 84×128 in a 336×128 group, sharing 1px dividers. Each divider is drawn once — cell 1 carries the left edge and left radii, cell 4 the right edge and right radii — so the seams are 1px, not 2px.
- Tokens keep Figma's own names: `--fill` `#fafafa`, `--border` `#e4e4e4`, `--highlight` `#107a4d`, `--fill-disabled` `#f3f2f2`, `--text-color-1` `#323232`, `--text-color-disabled` `#858585`.
- The active ring is 3px `#107a4d`, 4px radius, `0 4px 4px rgba(0,0,0,.25)`.
- Icons are the exported vectors, not redrawn.

Two places where the file needed a judgement call:

**Digit baseline.** Figma sits the digits about 2px below the cell's geometric centre — measuring the exported PNG puts the baseline at y=79 in a 128px cell, consistently across frames. Pure flex centring lands on 77.2. The cells match Figma (79.1) rather than the optical ideal, since the brief asks for the drawing.

**The 1px the file disagrees with itself about.** The empty and filling frames put the cells at y=427; the submit frame puts them at y=426. The cells are the anchor here — pinning them to the true centre keeps them from twitching by a pixel the moment you submit — and the status row then sits 97px above, landing on Figma's y=394 exactly. Both halves match.

**There is no error state in Figma.** It is drawn with the same anatomy as verifying — 32px icon, 8px gap, 24px label, same position — in a red that mirrors the green's weight, reusing the exact square frame from the check icon so the cross is drawn in the same hand.

## Interaction notes

**The ring trails the cursor.** It rests on the digit you just typed, not on the next empty cell. That is what the Figma filling frame shows — `1 2 2` highlights the *third*, filled cell — and it reads as a carriage that advances when the next key lands. It is one element that slides between cells on a spring, rather than four that blink on and off. On the two end cells its outer corners pick up the group's 16px radius, so it follows the rounded edge instead of cutting a 4px corner across it.

**Digits arrive and leave through the same door**, rising into the cell on a spring and dropping back out, like a mechanical counter. Pasted digits stagger left to right at 45ms so the fill reads as a fill rather than a flash.

**A refused key wiggles; a wrong code shakes.** Same gesture, different conviction — a letter gets 5px over 220ms, a failed submission 12px over 420ms. Feedback, not punishment.

**The cells never move.** Verification brings the status row in above them rather than pushing them down.

**Success is a handoff, not a crossfade.** The two halves take turns: the check swaps in immediately, a green acknowledgement ripples across the cells, they fade out in place, and only then does the row travel down into the centre where the authenticated frame draws it. Overlapping them put a descending row on top of still-opaque cells with the cells drifting up against it — two motions crossing in opposite directions. Measured on the live page, the cells reach zero opacity before the row leaves y=394.

### Forgetting the passcode

After a failed attempt, **Forgot passcode?** appears under the field and stays — it outlives the error state itself, which clears after 900ms, because one glimpse of an escape route is not an escape route. It leads to the same four cells asking a different question: "Choose a new passcode", with a line of subtext and a Cancel.

The chosen code is registered and becomes the one that opens the door; the old one stops working. Choosing and entering share the `idle → filling → complete` progression, so rather than duplicating those three states per purpose, the machine carries an `intent` (`verify` or `create`) alongside the lifecycle. Registering resets the attempt count — the old code's failures are not the new one's.

### Surviving a refresh, and arriving by link

A partial entry is kept in `sessionStorage` and restored on load with a quiet "Picked up where you left off". Only ever a *partial* one: a complete code is either in flight or already answered, and restoring it would resubmit on load.

A code can also arrive in the URL (`?code=1234`), as a magic link would. It fills the cells with the same staggered animation a paste uses, and a toast says where it came from. Two deliberate choices: it does **not** auto-submit, because a code that verifies itself before the explanation can be read is not an explanation; and the `code` parameter is stripped from the address bar immediately, so a shared or bookmarked URL does not carry a passcode around with it. Other parameters are left alone.

> **On persisting a passcode.** A real product should not write one to storage at all — it would keep an in-progress entry in memory and accept that a refresh loses it, or hold it server-side against a short-lived token. `sessionStorage` is the compromise here: scoped to the one tab, gone when it closes. It is called out in `src/lib/session.ts` rather than left as an implicit decision.

### Responsive

The layout is built for the 1512×982 artboard and adapts down from there. Below 768px the panel stops sharing the screen: it starts closed behind a toggle and opens over the stage with a scrim, dismissing itself when you pick a state so it is not covering the thing it just triggered.

The stage scales down to hold a 16px gutter on both axes — 200% zoom halves the height as well as the width, and the height clamp is what keeps the button below the cells from being cut off. Scaling rather than reflowing preserves the proportions and the 97px handoff, and it only ever scales *down*, so the desktop rendering stays pixel-exact. Verified at 320×480 with no horizontal scrolling.

The scale is written straight to a CSS variable rather than held in React state, and measured immediately as well as observed. A `ResizeObserver` only reports once it has a frame to report against, which left the first paint unscaled; and the panel opening changes the stage's width without the window resizing, so the immediate measurement, the `resize` listener and the observer each cover a case the others miss.

**Failure recovers itself.** The error holds for 900ms, then clears and springs the ring back to the first cell, focus intact, ready to retype without a click. After three attempts it stops being coy and offers the code — a dead end is not a delightful place to leave someone.

**Refusals explain themselves** in a line under the cells: "Numbers only", "Enter all 4 digits". Pasting junk is not one of them — a code copied out of an email with a stray dash or space is silently cleaned rather than rejected.

### Accessibility

- `prefers-reduced-motion` collapses every spring, shake and stagger to a plain fade, and stops the spinner and caret.
- An `aria-live` region announces digit count, verifying, authenticated and failure.
- Focus rings use `box-shadow` so they respect the radius; the field never steals focus on load, which is also what keeps the empty state matching the drawing exactly.
- Digits render at 36px and the input at 36px, above the 16px threshold that makes iOS zoom on focus.
