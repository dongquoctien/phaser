---
name: phaser-ui-ux
description: Build correct, bug-free UI/UX in a Phaser game — modal overlays that actually block input underneath, scrollable lists (radius vs scale, header occlusion, scroll-arrows, drag-vs-tap), predictable pre-selection (not random), ground-plane perspective FX, text-entry fields (DOM input), and depth/draw-order. Use when adding or fixing any in-game UI — popups, pickers, menus, leaderboards, tutorials, dialogs, HUD overlays — or when a UI "lets clicks through", "scrolls wrong", "header disappears", "input doesn't type", "effect looks tilted/wrong", or "picks random". The hard-won UI counterpart to game-design (feel) and phaser-review (code).
---

# Phaser UI/UX (this monorepo)

Phaser is a **canvas renderer, not a DOM UI toolkit** — there are no native buttons,
text fields, modals, scroll views, or z-index. You build them from GameObjects, and a
handful of non-obvious traps bite every time. These are the real bugs shipped + fixed in
twdc-defense; bake them in from the start.

---

## 1. Modal overlays MUST block input underneath (the click-through bug)

A `dim` rectangle with `.setInteractive()` does **NOT** stop taps reaching the gameplay
handlers below it. Scene-level `this.input.on('pointerdown', onFieldTap)` fires for **every**
pointer event regardless of what's on top — so a tutorial/popup is open and the player still
taps a pad/button underneath. (Hit this with the How-to-Play overlay.)

**Fix — a modal flag the gameplay handlers check FIRST:**
```ts
private overlayOpen = false;            // true while ANY modal is up
private onFieldTap(p: Phaser.Input.Pointer): void {
  if (this.overlayOpen) return;          // ← swallow taps while a modal is up
  // ...normal field handling
}
// when opening: this.overlayOpen = true;  when closing: this.overlayOpen = false;
```
Set the flag in the overlay's open path and clear it in its close/onDone callback (pass an
`onClose` so the flag is tied to the overlay lifecycle, not a fragile timer). **Also guard
drag-start and any "press any key to continue" keyboard handler** with the same flag — a
keystroke meant for a text field, or a stray drag, must not leak into gameplay.

The interactive `dim` is still worth adding (it eats taps on objects *below it in the same
container's draw order*), but the **scene-level handler guard is the real fix**.

---

## 2. Scrollable lists — four traps

A growing list (hero roster, leaderboard) overflows the screen. Building a scroll view:

- **Tween `radius`/position, NOT `scale`, for a stroked ring/expanding shape.** Scaling a
  small circle up multiplies its **stroke width** too — a 2px outline at scale ×130 becomes
  260px and spills everywhere. (Hit this on a range-pulse ring.) Tween the actual `radius`
  property so the stroke stays 2px and the shape stops exactly where intended.
- **Header text vanishes when you scroll.** Tiles scrolled up cover the title because the
  title was added to the container **before** the list pane. Phaser containers draw in
  **add-order, not z-index** (no real depth inside a container). Draw an **opaque header
  strip + title AFTER the scrolling pane** so they occlude tiles passing under them. (Same
  rule fixes a close-button hidden behind a detail pane — add it last.)
- **Show scroll affordances.** Players don't know a list scrolls. Add ▲ / ▼ "more" chevrons
  that appear only when there's content off-screen that way; update them on drag/wheel/open
  (`y < scrollTop` → show ▲; `y > scrollMin` → show ▼).
- **Suppress the tap-select during a drag-scroll.** A drag to scroll also lands as a
  `pointerup` on a list item → it selects something on release. Track a `dragged` flag (set
  once movement exceeds ~6px) and skip the tap-select when it's set; reset on the next
  pointer-down.

Bound the scroll: `scrollMin = min(0, visibleBottom - contentHeight)`, clamp `pane.y` to
`[scrollMin, 0]`. This survives the list growing later — never hard-code a row count.

---

## 3. Pre-select the LAST choice, never random

A picker that pre-highlights a **random** entry on open feels arbitrary and unpredictable.
Remember the player's last pick and pre-select that (default to a sensible first item, e.g.
the cheapest/starter), and **reset that memory on each new game** — Phaser reuses the scene
instance across `scene.restart()`, so an instance field persists between runs unless you
reset it in `create()`.
```ts
private lastPicked: Id = 'starter';                 // field default
// create(): this.lastPicked = 'starter';           // reset each new game
// on open:  selectInPicker(this.lastPicked);        // not Phaser.Utils.Array.GetRandom(...)
// on pick:  this.lastPicked = id;                   // remember
```

---

## 4. Ground-plane perspective: rotate INSIDE a flattened container

A magic circle / shadow / AoE ring lying "flat on the ground" in a top-down-tilted game is
a **squashed ellipse** (`scaleY ≈ 0.4–0.5`). If you flatten THEN spin it (`g.setScale(1,0.42)`
then tween `g.rotation`), Phaser applies **scale-then-rotate to one object** → the whole
ellipse tilts and wobbles like a flipping disc. Geometrically wrong.

**Fix — separate the two transforms across a parent/child:** a **Container** holds the
foreshortening (`setScale(1, 0.42)`, never rotates); the art rotates **inside** it. Render
order becomes rotate-in-ground-plane → foreshorten → a fixed ellipse with the pattern
spinning within. (Same logic for any "decal on the floor" that animates.)

---

## 5. Text entry — there is no Phaser text field

For a name/nickname prompt, drive entry off **both** the keyboard (desktop) **and a hidden
HTML `<input>`** over the canvas (mobile — focusing it raises the soft keyboard; read its
`value` back on `input`). Validate length, disable the confirm button until valid, and on a
**forced** first-run prompt give a "RANDOM/skip" that assigns a default so nobody is left
nameless. Remove the DOM input + keyboard listener on close (leak-free). **Guard the scene's
"any key starts the game" handler** with the modal flag (rule #1) so typing doesn't launch
the game.

---

## 6. Depth / draw-order quick rules
- **Global `setDepth(n)`** orders top-level scene objects. **Inside a Container**, depth is
  ignored — only **add-order** matters. To put X above Y in a container, add X later.
- Overlays: pick a high depth band per layer (HUD ~30–60, picker ~70, tutorial ~98,
  leaderboard ~130) so a new modal always lands above the last.
- A modal's backdrop should be a full-screen rect at the overlay's base depth; the card +
  controls above it; the close button **last**.

---

## 7. Reusable-overlay shape (what worked)
Make each overlay a **self-contained function** `showThing(scene, opts?)` that builds a
container, wires its own close (destroying the container + calling `opts.onClose`), and
cleans up any DOM/listeners — not a method tangled into a scene. Callers set the modal flag
on open and clear it in `onClose`. This is how NicknamePrompt / LeaderboardPanel stay
testable and leak-free.

## Verify (Playwright MCP)
- Open a modal → tap a gameplay pad/button underneath → assert **nothing happens** (no
  placement, no scene change). Type while a text modal is up → assert the game didn't start.
- Scroll a list to the bottom → assert the last row is fully on-screen, the header still
  shows, and ▲/▼ toggle correctly. Drag-scroll → assert it did NOT select an item.
- Reopen a picker → assert it pre-selects the last pick; start a new game → assert it reset.
- 0 console errors; modal closes cleanly (container destroyed, no orphan DOM input).

## Anti-patterns to refuse
- Relying on an interactive `dim` alone to block input — add the scene-handler modal guard.
- Tweening `scale` on a stroked ring/shape that should grow (stroke balloons) — tween radius.
- Adding a header/close-button BEFORE the scrolling content (it gets covered) — add it after.
- Pre-selecting a **random** item; forgetting to reset per-run state in `create()`.
- Flatten-then-rotate for a ground decal (tilts) — rotate inside a scaleY container.
- Expecting a native text field; leaking the hidden DOM input / keyboard listener.
- Hard-coding a list's row count into its scroll bounds (breaks when the list grows).

See also: **game-design** (how UI should *feel* — juice, readability), **phaser-review**
(scene-lifecycle cleanup, key constants), **phaser-smoketest** (the verify harness).
