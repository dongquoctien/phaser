---
name: phaser-ui-ux
description: Build correct, bug-free UI/UX in a Phaser game — modal overlays that actually block input underneath, scrollable lists (radius vs scale, header occlusion, scroll-arrows, drag-vs-tap), predictable pre-selection (not random), ground-plane perspective FX, text-entry fields (DOM input), depth/draw-order, and icons (pixel-icon LIBRARY first — pixelarticons MIT, baked to PNG — draw only the gaps; NO emoji/runtime-SVG). Use when adding or fixing any in-game UI — popups, pickers, menus, leaderboards, tutorials, dialogs, HUD overlays, icons/badges — or when a UI "lets clicks through", "scrolls wrong", "header disappears", "input doesn't type", "effect looks tilted/wrong", "picks random", or uses an emoji as an icon. The hard-won UI counterpart to game-design (feel) and phaser-review (code).
---

# Phaser UI/UX (this monorepo)

Phaser is a **canvas renderer, not a DOM UI toolkit** — there are no native buttons,
text fields, modals, scroll views, or z-index. You build them from GameObjects, and a
handful of non-obvious traps bite every time. These are the real bugs shipped + fixed in
twdc-defense; bake them in from the start.

For **pixel-art games UI/UX matters even more** — the graphics are simple, so the UI is
what makes the game read as easy-to-play, professional, and "đã tay". Plan it (§0) AND
avoid the implementation traps (§1+).

---

## 0. Plan the UI/UX — inventory + the 4 UX pillars (do this when designing the game)

**UI (what's on screen)** vs **UX (how it feels)** — a pixel game needs both. When
scaffolding/designing a game (pairs with `phaser-new-game` §0d asset plan), decide which
of these screens the game needs and list them in the ASSET-PLAN so the UI art + layout
are planned, not bolted on:

- **HUD (in-play):** HP bar · mana/stamina · skill slots + cooldown · coin/gold ·
  minimap · quest tracker · boss HP bar. Side-scroller convention: **HP top-left, skills
  bottom, boss bar top-centre**, minimal + semi-transparent so it never hides gameplay.
- **Main menu:** Start · Continue · Settings · Exit · save slots.
- **Inventory:** equipment slots · item grid · drag/drop · tooltip · stats.
- **Skill UI:** skill icon · cooldown sweep · combo · buff/debuff row.
- **Dialogue:** NPC text box · portrait · choice selection · typewriter reveal.
- **Shop / craft:** item list · price · buy/sell · craft recipe + materials.
- **Pause / settings:** audio · keybind · graphics · language · controller.

**The 4 UX pillars (this is what makes a pixel game feel good — enforce them):**
1. **Combat feedback — "feel the hit".** Every hit needs: **hit-flash** (tint+FILL) +
   **screen shake** (2–5px) + **hit sound** + **damage number** + a little **hit-stop** +
   a **particle burst**. Without these, combat feels dead. (Magnitudes + Phaser-v4 how-to
   live in the `game-design` skill's juice table — use them.)
2. **Input feel — responsiveness beats graphics.** Low jump delay, responsive dash,
   attack/animation cancel, **coyote time + jump buffer** (see `phaser-new-game` Player).
   Read input every frame, not in `pointermove` (see §5 + perf-audit §6a).
3. **Visual hierarchy — the player must instantly see, in order:** enemy → danger → skill
   → HP → loot. Size/colour/placement should rank them; don't let HUD bury threats.
4. **Readability — pixel art clutters fast.** Keep strong **contrast** (background vs
   character), **outlines/selout**, and a **clear silhouette**; never let FX cover the
   gameplay or let too many colours muddy the scene. (See `pixel-art` craft gates.)

**UI style** (pick one, match the game's era/theme): retro-NES (simple, pixel font, few
anims) · SNES-RPG (window panels, gradient, RPG icons) · modern-indie (minimal, clean,
motion + nice FX) · dark-fantasy (ornate frames, muted palette). **A UI asset pack
typically needs:** buttons · panels/frames · bars · icons; (RPG) inventory slot · skill
icon · quest window; (combat) damage font · combo UI · boss HP bar; (FX) cursor glow ·
hover · screen transition. **Pixel font** must be readable, correctly spaced, and never
blurred (integer scale, nearest-neighbor) — icons from a pixel-icon library per §8 (draw
only the gaps), never emoji.

**Build order:** (1) wireframe menu/HUD/inventory → (2) pixel UI assets (panel/button/
icon) → (3) UI animation (hover/popup/transition) → (4) UX polish (sound/feedback/juice/
responsiveness). The strongest modern-indie combo: 32×32 pixel art + side-scroller +
dynamic SFX + minimal modern pixel UI + strong combat feedback + fast responsive control.

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

### 1b. The overlay closes the instant it opens (open-on-down vs close-on-up)
A modal opened on **pointerDOWN** whose backdrop `dim` closes on **pointerUP** dismisses
itself on the SAME click: the button's pointerdown builds the full-screen dim, then the
pointerUP that ends that very click lands on the freshly-created dim → close. It looks like
"the popup flashes and vanishes". (Only reproduces with a realistic click that holds down a
frame — long enough for the dim to register its listener; an instant synthetic down→up can
miss it, so test with a held click.)

**Fix — the dim only closes on a gesture that BOTH starts AND ends on it.** Arm it on its
own pointerdown; act on pointerup only if armed (so the leftover up from the opening click
is ignored):
```ts
let armed = false;
dim.on('pointerdown', () => { armed = true; });
dim.on('pointerup', () => { if (armed) close(); });
```
(Alternatively, open the menu button on pointerUP too — but arming the dim is robust even
when the opener is pointerdown.) Buttons inside the card use their own `pointerup` at a
different location, so they're unaffected.

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

## 5. Text entry — there is no Phaser text field (and the mobile-keyboard trap)

For a name/nickname prompt, overlay a **real HTML `<input>`** on top of the canvas. The
naive "hidden 1px input + `focus()` on open" approach **WORKS ON DESKTOP BUT IS BROKEN ON
MOBILE** — the soft keyboard never appears. Three independent reasons, all must be fixed:

1. **`pointer-events:none` blocks the keyboard.** A non-touchable input won't raise the OS
   keyboard. Remove it — the input must be tappable.
2. **`opacity:0` / `width:1px;height:1px` is refused.** Mobile browsers won't open the
   keyboard for a fully-hidden / zero-size input. Give it a **real size** (cover the on-screen
   box) and `opacity:0.01` — present but see-through, with `color/background/caret-color:
   transparent` so the native value doesn't double over your Phaser text.
3. **iOS only focuses inside a SYNCHRONOUS user gesture.** `setTimeout(()=>input.focus())`,
   a promise, or rAF before `focus()` is silently ignored on iOS Safari — the keyboard won't
   open. Call `input.focus()` **directly in the pointer/touch handler** (e.g. tapping the
   box). An initial focus on open is fine for desktop/Android but won't raise iOS's keyboard.

So: position a real `<input>` over the box (map game→CSS px through `canvas.getBoundingClientRect()`,
re-run on resize/scroll), `font-size:16px` to stop iOS zoom-on-focus, read its `value` on the
`input` event, and draw the themed text + caret in Phaser on top. **Don't double-count
keystrokes:** if you ALSO keep a desktop `keydown` fallback, early-return it when
`document.activeElement === theInput` (else the input's `input` event *and* the keydown both
append → "MMoobbiillee"). Validate length, disable confirm until valid, give a "RANDOM/skip"
on a forced first-run prompt, and remove the input + all listeners (resize/scroll/keydown) on
close. **Guard the scene's "any key starts the game" handler** with the modal flag (rule #1).

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

## 8. Icons: NO color emoji — use a PIXEL ICON LIBRARY first, draw only the gaps
Never use a color emoji (🏆 👑 🔒 👆 ✨ 🟦 ♪ ☰ ✎ …) as an in-game icon. Emoji render
differently per OS/font (a mono glyph like `♪`/`☰` becomes a colour emoji on iOS/Android),
break the pixel aesthetic, and can't be themed.

**DEFAULT: pull icons from a pixel-icon LIBRARY for consistency — don't hand-draw what
already exists.** Hand-drawn char-grids are uneven and slow; a curated set is cohesive and
free. Use **pixelarticons** (https://pixelarticons.com · https://github.com/halfmage/pixelarticons)
— **MIT**, ~800 free icons on a **24×24 pixel grid** (menu, edit/pen, trophy, close, volume/
volume-3, arrow-/chevron-*, heart, lock, …). (Alternative surveyed: Pixel Icon Library —
also free.) **Verify the license** (MIT/CC0) and **vendor the subset you use** + its LICENSE
under `games/<game>/assets-src/<lib>/` so the dependency is pinned and attributed.

**Integrate by BAKING the SVGs to PNG offline at the native 24px grid — NOT `this.load.svg`
at runtime.** Under `pixelArt:true` at a small internal res, a runtime-rasterized SVG goes
blurry; these icons are authored on a pixel grid, so baking each at exactly 24px (nearest
kernel) yields a true pixel sprite the engine then nearest-neighbor scales cleanly. A repo
script does it (see `scripts/bake-icons.mjs` in cave-collector):
```js
// node scripts/bake-icons.mjs — sharp rasterize vendored SVGs → public/assets/icons/<key>.png
const svg = readFileSync(file,'utf8').replace(/currentColor/g, '#ffffff'); // white; tint per use
await sharp(Buffer.from(svg), { density: 384 }).resize(24, 24, { kernel: 'nearest' }).png().toFile(out);
```
Then load each as a normal texture in PreloadScene and place it as an `Image`, tinting per
use (`.setTint(0xffe14d)`) and sizing with `setDisplaySize(11,11)` next to a text label.
Add an `Icon` key block + an `ICON_FILES` map in `types/keys.ts` (never raw strings).

**FALLBACK — draw a pixel-art icon via Graphics ONLY when the library lacks it.** Author a
bitmap as a char-grid + palette and render each pixel as a `fillRect` cell:
```ts
// systems/Icons.ts — for the rare icon no library has
function drawPixels(scene, x, y, rows: string[], palette: Record<string, number>, cell: number) {
  const c = scene.add.container(x, y); const g = scene.add.graphics();
  const w = Math.max(...rows.map(r => r.length)), ox = -(w*cell)/2, oy = -(rows.length*cell)/2;
  rows.forEach((row, r) => [...row].forEach((ch, col) => {
    if (ch !== '.' && palette[ch] !== undefined) g.fillStyle(palette[ch], 1).fillRect(ox+col*cell, oy+r*cell, cell, cell);
  }));
  return c.add(g);
}
```
Returning a Container lets callers `setScale`, place it beside a label, or add a pulse tween.
**Don't mix sources for the same UI** — if the set is library icons, draw the one missing
glyph in a matching weight, don't leave it as a different style. Plain single-colour **text**
glyphs (★ ✕ ▸ → ✓ ⚔) are fine — font characters, crisp, not emoji.

## Verify (Playwright MCP)
- No color emoji in `src/` (scan unicode emoji ranges; allow text glyphs ★✕▸→✓). Icons
  render as library/baked pixel textures (or drawn Graphics for the gaps) — screenshot
  Menu/overlays/touch-HUD to confirm, and that baked icons load (`textures.exists('ic-…')`).
- Open a modal → tap a gameplay pad/button underneath → assert **nothing happens** (no
  placement, no scene change). Type while a text modal is up → assert the game didn't start.
- Open a modal with a **realistic held click** (down → wait a frame → up) → assert it
  STAYS open (not dismissed by its own opening click's pointerup); then a fresh backdrop
  click closes it. (§1b — instant synthetic down→up won't catch this.)
- Scroll a list to the bottom → assert the last row is fully on-screen, the header still
  shows, and ▲/▼ toggle correctly. Drag-scroll → assert it did NOT select an item.
- Reopen a picker → assert it pre-selects the last pick; start a new game → assert it reset.
- 0 console errors; modal closes cleanly (container destroyed, no orphan DOM input).

## Anti-patterns to refuse
- Relying on an interactive `dim` alone to block input — add the scene-handler modal guard.
- A modal opened on pointerDOWN whose dim closes on pointerUP — it dismisses on the opening
  click. Arm the dim (close only on a down+up that both happen on it). See §1b.
- Tweening `scale` on a stroked ring/shape that should grow (stroke balloons) — tween radius.
- Adding a header/close-button BEFORE the scrolling content (it gets covered) — add it after.
- Pre-selecting a **random** item; forgetting to reset per-run state in `create()`.
- Flatten-then-rotate for a ground decal (tilts) — rotate inside a scaleY container.
- Expecting a native text field; leaking the DOM input / keyboard listener on close.
- A `pointer-events:none` / `opacity:0` / 1px input, or an async/`setTimeout` `focus()` — the
  mobile soft keyboard won't open (iOS needs a real, visible input focused *synchronously in a
  tap*). Double-counting keystrokes from input-event + keydown both firing.
- Hard-coding a list's row count into its scroll bounds (breaks when the list grows).
- Using a color emoji (or a mono glyph like ♪/☰/✎ that becomes one on mobile) as an icon —
  use a pixel-icon library (pixelarticons, MIT) baked to PNG; draw via Graphics only the gaps.
- `this.load.svg` for icons under `pixelArt:true` (blurry) — bake the SVG to a 24px PNG offline.
- Hand-drawing every icon when a free pixel library already has it (inconsistent + slow).

See also: **game-design** (how UI should *feel* — juice, readability), **phaser-review**
(scene-lifecycle cleanup, key constants), **phaser-smoketest** (the verify harness).
