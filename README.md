# Passcode

A four-digit authentication code entry experience, built as a design engineering take-home.

The app is laid out as a state machine explorer. The panel on the left lists every state and edge case, and clicking one drives the real component on the right into that state. The passcode stays interactive throughout, and the highlight follows the machine, so typing by hand moves it to whichever state you have arrived at.

**The code is `1234`.**

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Tests are `npm test`. Other scripts: `npm run build`, `npm run lint`. Requires Node 20+.

## Keyboard

| Key | Does |
| --- | --- |
| `0`–`9` | Enter a digit and advance. Typing anywhere focuses the field, so there is no click first |
| `Backspace` | Clear the last digit |
| Hold `Backspace` | Cascade back through the cells on native key repeat |
| `Enter` | Submit |
| `⌘V` | Paste. Non-digits are stripped, longer codes truncated |
| `Esc` | Start over |
| `⌘\` | Show or hide the panel. Hidden, the stage is exactly the 1512×982 Figma artboard |

A full code submits itself after a 320ms beat, so `Enter` is optional rather than a toll. Verification takes 1.6s.

## How it is built

Next.js (App Router) + TypeScript, Tailwind v4 for the reset and tokens, [Motion](https://motion.dev) for animation, Inter through `next/font`. No backend; verification is a simulated round-trip.

```
src/
  lib/passcode-machine.ts   the flow as a pure reducer
  lib/scenarios.ts          scripted walkthroughs for the panel
  lib/session.ts            the sessionStorage draft and ?code= handling
  hooks/usePasscode.ts      wires the machine to real time and to the keyboard
  hooks/useMediaQuery.ts    the mobile breakpoint
  components/               PasscodeFlow, PasscodeCell, StateSidebar, Toast, Icons
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

The flow is a plain reducer rather than component state, and that is what makes the panel possible: a scenario dispatches the same events a keystroke does, so a demo cannot drift from the real behaviour. There is no second code path. A scenario's `holdAt` pauses the automatic transitions at the state being shown, so `submitting` can be looked at instead of watched racing past; any real interaction lifts the freeze.

Choosing a code and entering one share the `idle → filling → complete` progression, so the machine carries an `intent` (`verify` or `create`) alongside the lifecycle instead of duplicating three states per purpose.

### One real input

All four cells are painted over a single native `<input>`, the [input-otp](https://input-otp.rodz.dev) approach, which buys paste handling, key repeat on backspace, the mobile numeric keyboard, `autocomplete="one-time-code"` autofill and screen reader support for free. Digits are handled in `keydown` with `preventDefault` so the machine is the only thing that can change the value; arrow keys and Home/End are swallowed so the invisible caret cannot drift out of sync.

## Matching the Figma

Sizes, colours, radii, weights and border structure come from the file, verified by measuring the live DOM against it.

- Cells are 84×128 in a 336×128 group, sharing 1px dividers. Each divider is drawn once (cell 1 carries the left edge and left radii, cell 4 the right) so the seams are 1px, not 2px.
- Tokens keep Figma's own names: `--fill` `#fafafa`, `--border` `#e4e4e4`, `--highlight` `#107a4d`, `--fill-disabled` `#f3f2f2`, `--text-color-1` `#323232`, `--text-color-disabled` `#858585`.
- The active ring is 3px `#107a4d`, 4px radius, `0 4px 4px rgba(0,0,0,.25)`.
- Icons are the exported vectors, not redrawn.

Two places needed a judgement call.

**Digit baseline.** Figma sits the digits about 2px below the cell's geometric centre: measuring the exported PNG puts the baseline at y=79 in a 128px cell, consistently across frames, where pure flex centring lands on 77.2. The cells match Figma (79.1) rather than the optical ideal, since the brief asks for the drawing.

**The 1px the file disagrees with itself about.** The empty and filling frames put the cells at y=427, the submit frame at y=426. The cells are pinned to the true centre so they cannot twitch by a pixel on submit, and the status row then sits 97px above, landing on Figma's y=394 exactly.

There is no error state in Figma. It is drawn with verifying's anatomy (32px icon, 8px gap, 24px label, same position) in a red that mirrors the green's weight.

## Interaction notes

- The ring rests on the digit just typed rather than the next empty cell, which is what the Figma filling frame shows: `1 2 2` highlights the third, filled cell. It is one element sliding between cells on a spring.
- Digits rise into a cell on a spring and drop back out; pasted ones stagger left to right at 45ms. A refused key wiggles 5px over 220ms, a failed submission shakes 12px over 420ms.
- The cells never move. Verification brings the status row in above them, and on success they reach zero opacity before that row travels down into the centre.
- The error clears itself after 900ms and springs the ring back to the first cell with focus intact. Refusals name themselves under the cells ("Numbers only", "Enter all 4 digits"); pasted junk is cleaned silently instead.
- Below 768px the panel starts closed behind a toggle and opens over the stage with a scrim. The stage scales down, never up, to hold a 16px gutter on both axes, so the desktop rendering stays pixel-exact. Verified at 320×480.

### Forgetting the passcode

After a failed attempt, **Forgot passcode?** appears under the field and stays, outliving the error state, which clears after 900ms. It leads to the same four cells asking "Choose a new passcode".

The chosen code becomes the one that opens the door and the old one stops working, for the rest of that tab's session: the registered code lives in memory only, so a reload puts `1234` back. Registering also resets the attempt count. After three failed attempts the screen offers the code.

### Surviving a refresh, and arriving by link

The only thing written to storage is an in-progress partial entry of 1 to 3 digits, in `sessionStorage`, restored on load with a quiet "Picked up where you left off". A complete code is never written, since it is either in flight or already answered and restoring it would resubmit on load. The registered passcode is never written at all.

> **On persisting a passcode.** A real product should not write one to storage. What is kept here is a fragment of a code, scoped to the one tab and gone when it closes, and it is called out in `src/lib/session.ts` rather than left implicit.

A code can also arrive in the URL (`?code=1234`), as a magic link would. It fills the cells with the stagger a paste uses and a toast says where it came from. It does not auto-submit, and the `code` parameter is stripped from the address bar immediately, so a shared or bookmarked URL does not carry a passcode. Other parameters are left alone.

### Accessibility

- `prefers-reduced-motion` collapses every spring, shake and stagger to a plain fade, and stops the spinner and caret.
- An `aria-live` region announces digit count, verifying, authenticated and failure.
- Focus rings use `box-shadow` so they respect the radius. The field never steals focus on load, which also keeps the empty state matching the drawing.
- Digits and the input render at 36px, above the 16px threshold that makes iOS zoom on focus.
