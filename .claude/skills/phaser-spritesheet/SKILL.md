---
name: phaser-spritesheet
description: Cut a labeled, chroma-keyed character animation sheet (one big PNG — green background, a grid of cells, a text label above each animation row, like D:/Github/0assets/hero-animation/*.png) into clean Phaser-ready assets — a packed atlas PNG + atlas JSON + an anims JSON for anims.create. Drops the green, removes the baked-in row labels (no OCR), trims+recenters every frame into a uniform tile, and names rows by the canonical animation set. Use when the user wants to "cut a spritesheet", "slice sprites", "cắt spritesheet", "tách frame", "làm animation từ sheet", "extract sprite frames", or supplies a multi-row character sheet to turn into game animations.
---

# Phaser Spritesheet Cutter (this monorepo)

Turn a **labeled, chroma-keyed character sheet** into game-ready animations. The
source is ONE big PNG (the `0assets/hero-animation/*.png` shape):

- a bright **chroma-green** background (plus darker green **grid lines**),
- a **grid of cells** — each *row* is one animation, each *cell* a frame,
- a **text label** baked into the image above/beside each row
  (`IDLE_BREATHING`, `SHUFFLE WALK (FORWARD)`, `ATTACK_A (PUNCH)`, …),
- **variable frames per row** and slightly off-grid sprites.

You **cannot** `load.spritesheet({ frameWidth })` that — the baked-in label text
and uneven spacing break a naive uniform grid. The tool here detects the real
grid, drops the green, removes the labels (no OCR), trims+recenters every frame,
and emits a **packed atlas + atlas JSON + anims JSON**.

The companion **`pixel-art`** skill covers the *opposite* situation (you have ONE
static pose and must fake animation with tweens — its "Procedural animation from
ONE static sprite" section). THIS skill is the real-multi-frame path: when the
frames already exist in a sheet, slice them.

## When to use
- The user supplies a multi-row character/FX sheet and wants real frame animation.
- "cut / slice a spritesheet", "tách frame", "làm animation từ sheet", "extract
  sprites", "the sheet has labels / green background, turn it into a Phaser anim".
- After cutting: wire `load.atlas` + `anims.create` (recipe below), then verify with
  `phaser-smoketest`.

Not this skill: a single static image → use `pixel-art` (Level-1 tween fake-anim)
or `scripts/pixelate.mjs`. A clean uniform grid with NO labels and NO green → just
`load.spritesheet({ frameWidth, frameHeight })` directly, no cutting needed.

## The tool: `scripts/slice-spritesheet.mjs`

Node + `pngjs` only (already a devDependency — no native deps, runs on Windows).

```bash
node scripts/slice-spritesheet.mjs <sheet.png> [options]
```

| flag | meaning | default |
|------|---------|---------|
| `--out <dir>` | output directory | `./<name>-sliced` |
| `--name <key>` | base texture key | sheet filename, kebab-cased |
| `--anchor center\|bottom` | `bottom` = feet-anchored (recommended for walkers) | `center` |
| `--tile <px>` | uniform output tile, square | auto (largest frame + pad) |
| `--gutter <px>` | min gutter width to split two frames | `4` |
| `--rows <n>` | force N evenly-split rows (skip auto row detect) | auto |
| `--cols <n>` | divide each row into N equal cells (clean grids) | auto gutters |
| `--green <hex>` | chroma key colour hint | auto-sampled |
| `--tol <0..255>` | chroma key tolerance | `90` |
| `--keep-labels` | don't drop baked-in text labels | off (drops them) |
| `--label-aspect`/`--label-sat`/`--label-colors` | label-rejection tuning | see below |
| `--fps <n>` | default frameRate in the anims JSON | `10` |
| `--debug` | also write `_debug.png` with detected boxes drawn | off |

**Output** (in `--out`): `<name>.png` (packed atlas), `<name>.json` (Phaser atlas —
TexturePacker `textures[]`+`frames[]` array form, each frame with a `pivot`; parsed
by `load.atlas`), `<name>.anims.json` (`[{key,frames,frameRate,repeat}]`), with
`--debug` a `_debug.png`, and after `verify-spritesheet.mjs` a `preview.html`.

Two scripts: **`scripts/slice-spritesheet.mjs`** (cut) and
**`scripts/verify-spritesheet.mjs`** (build a live Phaser preview to auto-verify the
cut — see "Verify (auto)").

### Canonical workflow (ALWAYS do this)

1. **Run with `--debug` first** and OPEN `_debug.png` (Read it — it's an image).
   The red boxes show exactly what was detected. This is the single most important
   step — never trust the frame counts alone.
2. **Read the packed `<name>.png`** too — confirm each cell is one clean character,
   no label fragments, nothing clipped.
3. **If wrong, tune ONE flag** (see "Tuning" — usually `--gutter` or `--rows`),
   re-run, re-open. Iterate.
4. **Auto-verify the cut in a real browser** — `scripts/verify-spritesheet.mjs`
   builds a standalone Phaser preview from the atlas and asserts the animations
   actually PLAY (see "Verify (auto)" below). Do this BEFORE wiring into a game —
   it's the cheapest way to catch a mis-anchored or mis-segmented frame.
5. Copy outputs into the game's `public/` and wire `load.atlas` + `anims.create`.
6. **Verify in-game** with `phaser-smoketest` once it's wired.

```bash
# typical first pass for a hero sheet -> into a game's assets
node scripts/slice-spritesheet.mjs D:/Github/0assets/hero-animation/Anzu.png \
  --name anzu --anchor bottom --gutter 6 --debug \
  --out games/twdc-defense/public/heroes-anim/anzu

# whole folder (bash):
for f in D:/Github/0assets/hero-animation/*.png; do
  node scripts/slice-spritesheet.mjs "$f" --anchor bottom --gutter 6 \
    --out "games/<game>/public/heroes-anim/$(basename "$f" .png | tr A-Z a-z)"; done
```

## Verify (auto) — does it actually PLAY in Phaser?

`--debug` only proves the STATIC detection. To prove the animations *run*, load the
cut atlas in a real engine. `scripts/verify-spritesheet.mjs` writes a self-contained
`preview.html` next to the atlas that does the **exact game recipe** (`load.atlas` +
`anims.create` from the emitted JSON, one looping anim per cell) and exposes hooks
for a browser driver. This repo drives browsers with **MCP** (Playwright MCP, or
chrome-devtools MCP — same as `phaser-smoketest`); there is no Playwright npm dep,
so the *script* prepares + serves the page and the *driver* runs the asserts.

```bash
node scripts/verify-spritesheet.mjs <cut-out-dir>     # writes preview.html, prints asserts + serve cmd
npx --yes serve -l 5199 <cut-out-dir> &              # start the static server yourself (background)
# -> navigate to http://localhost:5199/preview.html
```

Then drive it via MCP and run the asserts (this is the auto-verify):

```js
// browser_navigate -> http://localhost:5199/preview.html, then browser_evaluate:
async () => {
  for (let i = 0; i < 50 && !window.__SS_READY__; i++) await new Promise(r => setTimeout(r, 100));
  const play = await window.__SS_PLAYING(450); // samples frame indices 450ms apart
  return {
    ready: !!window.__SS_READY__,   // create() finished
    anims: window.__SS_ANIMS__,     // expect = detected row count (e.g. 11)
    ...play,                         // { advanced, multiframe, playing }
  };
}
```

Pass = `ready:true`, `anims` equals the detected row count, **`playing:true`**, and a
clean console (ignore a favicon 404). `playing` is the key verdict: it's `advanced`
(frame indices changed in 450ms ⇒ animating) OR — when `multiframe:0`, i.e. every
anim is a single frame — `true` by definition, because a 1-frame anim *can't* advance
and that isn't a failure. `advanced:false` while `multiframe>0` is a real FAIL
(loaded but frozen). Then **take ONE screenshot** of the grid and READ it — confirm
each cell shows a clean character mid-pose, no label fragments, feet not clipped. If
MCP isn't connected, say so and fall back to `--debug` + the film-strip; never claim
a green run you didn't observe.

A no-browser fallback when MCP is unavailable: build a **film-strip** — read the
atlas JSON, blit each frame of a few key anims (idle/walk/attack/death) left-to-right
into one PNG, and READ it. It shows the exact frames in play order (static), which
catches segmentation/anchor errors even though it can't prove engine playback.

## How it works (the robust recipe — why each step)

1. **Chroma key (green → transparent).** Auto-samples the background from the sheet
   corners. A pixel is background if it's near that shade **OR** it's plainly
   *green-dominant* (`g` clearly exceeds `r` and `b`). The green-dominant rule is
   essential: these sheets draw **darker green grid lines** over the bright green
   field — a single sampled shade + tolerance misses the grid lines, they survive
   as "content", and the whole sheet floods into ONE connected blob. Keying all
   green-dominant pixels removes field *and* grid. A **despill** pass clamps the
   green channel on surviving edge pixels to kill the halo/fringe.
2. **Row segmentation by gutters, NOT connected components.** Connected-components
   fails here because the baked-in label text bridges cells. Instead we find
   **gutters**: scanlines that are ≥92% background. The non-gutter bands between
   gutters are the animation rows. (Projection-profile segmentation — a doc-analysis
   technique — applied to the alpha mask.)
3. **Column segmentation per row**, same gutter idea vertically. A gutter only
   counts as a frame boundary if it's at least `--gutter` px wide, so a 1–2px
   transparent gap *through* a sprite (between an arm and the body, or inside an FX
   puff) doesn't falsely split one frame into two.
4. **Label removal without OCR.** A baked-in text label and a character sprite
   differ on several axes; we combine them so no single noisy signal decides, scored
   per row against that row's OWN median sprite (scale-free):
   - **aspect** — characters are taller-than-wide or ~square; a wrapped multi-word
     label is distinctly *wide* (strongest signal),
   - **colour variety** — a label is a few flat colours; a sprite has dozens,
   - **saturation** — text is dark/flat; a character is colourful (skin/hair/clothes),
   - plus a tiny-speck filter (stray dots).
   Two or more strong hits ⇒ drop. `--keep-labels` disables it.
5. **Trim + recenter into a uniform tile.** Each frame is trimmed to its content
   bbox, then placed into a fixed square tile so frames line up when animated.
   `--anchor bottom` feet-anchors (no bob on walk/idle); `center` centers.
   Content larger than the tile is **downscaled only** (never enlarged) so Phaser
   nearest-neighbor-upscales crisply at render time (same rule as `pixelate.mjs`).
6. **Pack + emit** the atlas PNG, Phaser atlas JSON (named frames `idle_0`…), and an
   anims JSON. Rows are auto-named with the canonical animation set when the row
   count matches; else `row_0…` (override with `--names`).

### Canonical row names (the `0assets/hero-animation` set, in order)
`idle · upgrade · power · walk · attack_a · attack_b · hurt · death · spawn ·
victory · think` — auto-applied when exactly 11 rows are detected. `idle`/`walk`
get `repeat: -1` (loop) in the anims JSON; the rest play once.

## Tuning (when `_debug.png` looks wrong)

| Symptom in `_debug.png` | Fix |
|---|---|
| Whole sheet = 1 giant box | green key failed → pass `--green <hex>` (sample a bg pixel) or raise `--tol` |
| One sprite split into 2+ boxes | raise `--gutter` (e.g. `--gutter 8`) so internal gaps don't split |
| Two sprites merged into 1 box | lower `--gutter`, or the frames truly touch — accept, or use `--cols N` |
| Rows merged / wrong row count | force `--rows 11` (evenly splits content height) |
| Label text leaks in as a "frame" | lower `--label-aspect` (e.g. `1.4`) or `--label-sat` higher; verify it's not a real frame first |
| A real frame got DROPPED as a label | raise `--label-aspect`, lower `--label-sat`, or `--keep-labels` then trim by hand |
| Clean regular grid, all rows same count | `--cols N` (deterministic equal split, immune to internal gaps) |
| Sprites clipped at tile edges | raise `--tile`, or omit `--tile` to auto-size to the largest frame |
| Feet bob during walk/idle | `--anchor bottom` |

Black/low-colour characters (e.g. a black cat) still work — coloured eyes/accessories
give enough colour+saturation to pass — but check `_debug.png`; if a dark frame is
dropped, raise `--label-aspect` and lower `--label-sat`.

## Wiring the output into a Phaser game (this repo's conventions)

Put `<name>.png` + `<name>.json` under the game's `public/…` and load as an **atlas**
(not a spritesheet — the frames are named, which is what the anims JSON references).
Follow the repo's key-constant + PreloadScene conventions
(`games/twdc-defense/src/scenes/PreloadScene.ts`, `src/types/keys.ts`).

```ts
// PreloadScene.ts
this.load.atlas('hero-anzu', 'heroes-anim/anzu/anzu.png', 'heroes-anim/anzu/anzu.json');
this.load.json('hero-anzu-anims', 'heroes-anim/anzu/anzu.anims.json');

// in create() — register the animations from the emitted JSON, once:
const defs = this.cache.json.get('hero-anzu-anims') as
  Array<{ key: string; frames: string[]; frameRate: number; repeat: number }>;
for (const d of defs) {
  if (this.anims.exists(`anzu-${d.key}`)) continue; // idempotent (HMR / scene restart)
  this.anims.create({
    key: `anzu-${d.key}`,
    frames: d.frames.map((f) => ({ key: 'hero-anzu', frame: f })),
    frameRate: d.frameRate,
    repeat: d.repeat,
  });
}

// on a sprite — place it by the FEET; no setOrigin needed (see pivot note):
const hero = this.add.sprite(x, groundY, 'hero-anzu', 'idle_0');
hero.play('anzu-idle');             // loops (repeat:-1)
hero.play('anzu-attack_a');         // plays once
hero.once('animationcomplete', () => hero.play('anzu-idle'));
```

- **Feet pivot is automatic.** When cut with `--anchor bottom`, each atlas frame
  carries a `pivot:{x:0.5, y:(TILE-2)/TILE}`. Phaser's JSONArray/JSONHash atlas
  parser sets `frame.customPivot` from it, so a sprite created from the frame
  **auto-origins on the feet** — place it at `groundY` and it stands on the ground,
  no `setOrigin` call. (Do NOT also `setOrigin(0.5,1)` — that would fight the pivot.
  The 2px bottom pad means the true foot line is `(TILE-2)/TILE`, not exactly 1.0.)
  `--anchor center` emits a `0.5,0.5` pivot (centre origin) instead.
- **Namespace anim keys** per character (`anzu-idle`, not `idle`) — anim keys are
  global in Phaser; two heroes both registering `idle` collide.
- **Register anims once** and guard with `anims.exists` so a scene restart / Vite HMR
  doesn't throw "key already in use".
- The game is `pixelArt: true` → frames stay crisp; never `setScale` by a fraction
  (see `pixel-art` render gates). Scale the sprite by an **integer** factor.
- Keep the atlas in the game's texture-atlas budget — see `phaser-optimize-bundle`
  if many heroes inflate the build.

## Anti-patterns to refuse
- `load.spritesheet({frameWidth})` on a labeled/green sheet (label text + uneven
  spacing make a uniform grid wrong) — cut it first.
- Trusting the printed frame counts without opening `_debug.png`.
- Shipping the cut atlas without the `verify-spritesheet.mjs` playback check (the
  `advanced:true` assert) — a frame can look right packed but be mis-anchored or
  not animate at all. Then `phaser-smoketest` once it's wired into the game.
- Re-keying a sheet that has NO green and a clean grid — just load it as a
  spritesheet.
- Baking the upscale into the cut PNG (keep frames at source size; let Phaser
  nearest-neighbor-upscale).
- Registering global anim keys shared across characters.

See also: `pixel-art` (single-pose fake animation + crisp render gates),
`phaser-new-game` (scene/asset conventions), `phaser-smoketest` (verify the result
in a real browser), `phaser-optimize-bundle` (atlas/texture budget).
