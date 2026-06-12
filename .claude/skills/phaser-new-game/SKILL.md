---
name: phaser-new-game
description: Scaffold a new Phaser 4.1.0 + Vite + TypeScript game inside this monorepo, with the project-standard pixel-art config, scene structure, asset pipeline, and object-pooling/atlas conventions baked in. Use when the user wants to "create a new game", "add a game", "scaffold a Phaser game", "tạo game mới", "thêm game".
---

# Phaser — New Game Scaffold

Create a new, production-grade Phaser pixel-art game in this monorepo. Every game shares the same toolchain (Vite + TypeScript), so only per-game source is generated — the root tooling stays shared.

## 0. Conventions of this monorepo

```
phaser/
├─ package.json              # root: shared deps (phaser, vite, typescript), workspace scripts
├─ tsconfig.base.json        # shared TS config
├─ vite.config.shared.mjs    # shared Vite build config (see phaser-optimize-bundle)
└─ games/
   └─ <game-name>/           # one folder per game — self-contained
      ├─ index.html
      ├─ vite.config.mjs     # extends the shared config, sets base + outDir
      ├─ public/
      │  └─ assets/          # atlases (.png + .json), audio, tilemaps — served as-is
      └─ src/
         ├─ main.ts          # bootstrap: new Phaser.Game(config)
         ├─ config.ts        # the GameConfig object (one source of truth)
         ├─ scenes/
         │  ├─ BootScene.ts      # set scale, load the loading-bar atlas only
         │  ├─ PreloadScene.ts   # load ALL atlases/audio with a progress bar
         │  ├─ MenuScene.ts
         │  └─ GameScene.ts
         ├─ objects/         # GameObject subclasses (Player, Enemy, Bullet…)
         ├─ systems/         # pools, spawners, score — framework-agnostic logic
         └─ types/           # shared TS types/enums (SceneKeys, AssetKeys)
```

**Non-negotiables for "standard / pro / lightweight":**
- One **texture atlas per category** (sprites / ui / fx), never loose PNGs.
- **Object pooling** for anything spawned in a loop (bullets, particles, enemies).
- **String-key constants** in `types/` — never raw string literals for scene/asset keys.
- Arcade physics by default (Matter only if polygon collisions are truly needed).
- `physics.arcade.debug` and any FPS overlay are **off** in the production config.
- **Audio that works on iOS** — if the game has sound, ship `.m4a` AND `.ogg` for every
  clip and load `[m4a, ogg]` (iOS can't decode Ogg → silent iPhone). See `phaser-audio`.

## 0a. Art strategy — SVG by default, pixel ONLY when asked

The default visual style for a NEW game is **SVG vector art** (smooth, scalable,
crisp at any resolution). Use **pixel-art ONLY when the user explicitly says
"pixel"** (or the game is clearly retro/8-bit by request).

- **SVG default** → do NOT set `pixelArt: true`; load art with `this.load.svg(key,
  url, { scale } | { width, height })`. SVG **rasterizes once at load** — bake at the
  largest on-screen size (`{ scale: window.devicePixelRatio }` for HiDPI); upscaling
  past the baked size at runtime blurs. Keep `antialias` on (default) for smooth vectors.
- **Pixel mode** (only on request) → `pixelArt: true` + `render.roundPixels: true`
  (Phaser 4 defaults roundPixels to false). **Before drawing, ASK the user the sprite
  resolution** (see "Pixel resolution" below) — it sets the detail ceiling and the art
  budget. **HOW you produce the pixels matters — see §0b; do NOT hand-type a char-grid
  for a character.**
- **UI panels** that stretch → use the v4 `this.add.nineslice(...)` instead of a
  hand-rolled 9-patch.

## 0b. Producing pixel sprites — the right tool for the subject

The `src/pixel` `bakeSprite` helper renders a char-grid faithfully — it is **not** an
art generator. It is excellent for **simple, blocky shapes** (icons, tiles, HUD bits,
FX, hub thumbnails) where you can reason about every cell. It is the **WRONG** tool
for a multi-frame **character / monster / boss**: hand-typing a 32×32 ASCII grid for a
detailed creature produces flat, off-model, ugly sprites (a real, repeated failure) —
not because the renderer is bad, but because nobody can author good character pixel art
cell-by-cell in text. **Match the tool to the subject:**

| Subject | Tool |
|---|---|
| Characters / monsters / bosses, **when the user supplies a reference image or spritesheet** | crop the figure → `scripts/pixelate.mjs` for a still pose, or slice the spritesheet (`scripts/slice-spritesheet.mjs` for labeled green-screen sheets) for frames |
| icons, single tiles, HUD, small FX, hub `game.json` thumb | `bakeSprite` char-grid (`src/pixel`) — offline, free, deterministic |
| an existing high-res PNG the user supplies | `scripts/pixelate.mjs` (one static pose only — no frames) |

For a pixel CHARACTER with **no** supplied art, do NOT silently hand-type a char-grid —
say plainly that hand-drawn character grids come out low quality, and ask the user to
**supply a reference image / spritesheet** (then crop + pixelate or slice it). A
free AI pixel-art generator (e.g. PixelLab) is an option the *user* can run to produce
that reference; only use such a service through an MCP the user has already connected —
never assume one is configured. Reserve hand-authored grids for the simple-shape row.

**Hard rule (anti-pattern):** never hand-type a char-grid for a character/monster/boss.
That is exactly what made `arcane-knight`'s first cast look "vẽ quá xấu / không huyền bí".

### Pixel resolution — ASK before drawing pixel art (8 / 16 / 32 / 64)
The **grid size** (how many cells the sprite is, e.g. 16×16) — NOT the bake `px`
or the on-screen scale — is what sets how detailed the art can be. Each step up
**quadruples** the pixel count and the drawing time, so confirm it with the user
via `AskUserQuestion` before you start. (`px` in `bakeSprite` only enlarges the
source texture; on-screen size comes from integer `setScale` + nearest-neighbor.)

| Grid | Pixels | What it can show | Art time | Use for |
|------|--------|------------------|----------|---------|
| **8×8** | 64 | only a **silhouette** | fastest | tiny icons, particles, UI bits |
| **16×16** | 256 | the **category** ("bird/cat/skeleton"), bold + cohesive, retro NES charm | fast | **the repo default** — most game sprites today (frog/hero/enemy ~10–16) |
| **32×32** | 1,024 | **facial expressions**, shading, cloth/wood/grass texture | ~4× a 16×16 | hero/boss you want expressive; the "pro sweet spot" |
| **64×64** | 4,096 | **equipment, fine texture, anti-aliased edges**, realistic proportions | very high (a 64×64 8-frame walk ≈ a full day for a pro) | showcase characters only |

Guidance to give the user:
- **More pixels ≠ automatically better.** Low-res *forces* bold, consistent shapes
  and has its own charm; it's also far faster and stays cohesive with this repo's
  existing 16-ish sprites. Mixing 16×16 and 64×64 in one game looks inconsistent —
  **pick one tier and keep the whole game on it.**
- Recommend **16×16** by default (matches what's already shipped, fast, reads
  clearly at small size), **32×32** if they specifically want expressive
  characters, and only go 64×64 for a single showcase hero.
- Whatever tier: still follow the craft gates (Sweetie-16, ramps, one light dir,
  readable silhouette first) and Playwright-verify — see `pixel-art`.

> Full v4 API surface, breaking changes, and gotchas: **`.claude/skills/PHASER4.md`**.
> This project is on **Phaser 4.1.0** — the Canvas renderer is deprecated (use
> `Phaser.AUTO`), `Group#children` is a Set (use `getChildren()`), and
> `Textures.generate` is gone (use `Graphics.generateTexture`).

### Before drawing ANY art — research the web first, draw last
**Mandatory. Especially when the user did NOT provide a reference image — if they
gave no art, you MUST search the web before drawing, never invent from memory.**

> **This is a hard gate with a visible receipt — do it, don't just intend to.**
> Your FIRST action in the art step must be an actual `WebSearch`/`WebFetch` call.
> Before you draw a single grid, post a one-line **research receipt** to the user:
> the queries you ran, the candidate asset(s) + their license, and the
> style references you studied. If that receipt is missing, you skipped the gate —
> stop and do the research. "I know what a tower/frog/tank looks like" is exactly
> the from-memory shortcut this rule forbids; the point is to match what players
> expect and to reuse a verified free asset when one exists.

Research has two purposes (do both):
1. **Reusable asset hunt** — a fitting **CC0/free** asset that already works:
   CC0/free game art (**Kenney.nl**, **OpenGameArt**, itch.io "free"), or SVG icon
   sets (**game-icons.net** for game props, **lucide** / **tabler** for UI).
2. **Style/convention study** — search how this subject is normally drawn (e.g.
   "crossy-road frog top-down sprite", "survivor.io app icon") so your shapes match
   what players expect at small size, even when you hand-draw.
3. **Verify the LICENSE** — only CC0 / clearly-permissive / your-own. Never use art
   of unknown license (e.g. media in Phaser's own example repos is unlicensed).
4. **Verify it fits with Playwright**: drop the candidate into the game (or a tiny
   preview page), render it, screenshot, and judge — right silhouette, readable at
   game size, matches the other art's style/palette.
5. **Only if nothing fits → draw it** (SVG for default games via the `pixel-art`
   skill's craft rules, or a pixel grid if in pixel mode). Re-verify the drawn art
   the same way (zoom in; readable silhouette first).

> The hub **cover.svg** follows the same protocol — research the genre's icon
> style, draw, then Playwright-verify on a real card. See `pixel-art` §0 and
> "Adding a game cover / thumbnail".

## 0c. Level / map authoring — data arrays by default

The **default** way to author a level in this monorepo is a **plain data array in
code** (e.g. `games/arcane-knight/src/levels.ts`: platforms, enemy spawns, hazards,
exit). It's offline, diffable, has zero external dependencies, and is easy to verify —
right for almost every game here.

**Tiled is an OPTIONAL upgrade, only for map-heavy games** (large multi-screen worlds,
many hand-painted layers — metroidvania, big RPG overworld) where a visual editor
genuinely beats a data array. If a game is that, you MAY load Tiled `.tmj`/`.tsj` maps
(`this.load.tilemapTiledJSON` → `this.make.tilemap`), and the **Tiled MCP** (free, open
source) lets you read/place/fill tiles in those maps programmatically — but only when
the user has **already connected it**; never assume it's configured, and never convert
a simple game to Tiled just because the MCP exists. Tiled only *places* tiles — it does
not draw them, so you still need a real tileset first (see §0b). Keep small/medium games
on data arrays.

## 0d. Asset plan — a pro plans ALL art + audio up front

> ## 🛑 HARD GATE — write the ASSET-PLAN before you scaffold or write ANY gameplay code
> For any non-trivial game (anything beyond a one-screen toy), the **FIRST deliverable
> is `ASSET-PLAN.md`**, not code. Do NOT create scenes, objects, or systems until it
> exists. The visible receipt: copy `templates/ASSET-PLAN-TEMPLATE.md` → fill it →
> **post the image report + map report + audio report + UI/UX report (the tables) and
> the copy-paste generation prompts to the user**, then PAUSE for the user to review/
> generate assets. If you find yourself writing `class GameScene` / editing `config.ts`
> and there is no ASSET-PLAN.md in the game folder, you skipped the gate — stop, back
> up, and write the plan first. "I'll plan the art later" is exactly the shortcut this
> gate forbids (it's why a `/new-game` run jumped straight to code with no asset list).

You are a professional game developer: before writing gameplay, **decide what the game
needs** — images, audio, and the loose narrative/theme — and **research the web** so the
choices are genre-appropriate (see §0b research gate + the `game-design` skill for
deconstructing a reference and naming the loop).

### First — PIN DOWN THE ART DIRECTION (do this before any report or prompt)

Generation prompts are only as good as the direction behind them. Before writing the
plan, decide (and confirm with the user if unclear) **each of these axes** — then weave
ALL of them into every image prompt so the output is consistent and on-brief. Don't
default to "32×32 side-view chibi" silently; that mismatch is why early refs felt wrong.

- **Camera / perspective** — the FIRST decision; it dictates pixel art, animation, map
  design, gameplay and camera. The nine common views (with difficulty + a reference):
  1. **Side-scroller** (side view) — move L/R + jump; easiest animation; *Celeste, Dead
     Cells, Terraria*. **Easy, very common.**
  2. **Top-down** — 4/8-dir move; easy big maps; *Stardew Valley, Hotline Miami*. **Easy,
     very common.**
  3. **Isometric** — faux-3D 45°; looks premium but ~2× the art (multi-dir tiles +
     sprites); *Diablo II, Hades*. **Hard.**
  4. **Front view** — character faces the player; classic JRPG battle screen; *Pokémon
     R/B*. **Easy** (few frames).
  5. **3/4 view** (three-quarter) — slight tilt, see face + sides; the JRPG-overworld
     default, prettier than flat top-down. **Medium.**
  6. **Beat-em-up** — side movement WITH depth (walk up/down a lane); *Streets of Rage 4*.
     **Medium.**
  7. **First-person** — through the character's eyes; FPS / dungeon-crawler; *DOOM*.
     **Hard** (not a sprite pipeline).
  8. **Over-the-shoulder / third-person** — camera behind; rare in 2D pixel. **Hard.**
  9. **Tactical grid** — turn-based strategy on a square/iso grid; zoomed iso or top-down.
     **Hard** (lots of tiles).
  For an indie 32×32 pixel game prefer **side-scroller, top-down, or 3/4** — they save
  animation, read clearly at small size, and have the easiest tilesets. Isometric /
  tactical / third-person cost the most art. Confirm the view with the user before
  drawing — it changes everything downstream.
- **Character archetype** (per hero/enemy): knight/paladin · assassin/rogue · archer/ranger
  · necromancer · monk · viking · pirate · ninja · gunslinger · mecha pilot · angel/demon ·
  beast hunter · alchemist · bard · dragon warrior · sci-fi soldier · robot/android · slime
  hero · vampire hunter… (or a **mix** for a unique identity: cyber-samurai, ice-assassin,
  desert-necromancer, viking-zombie, holy-knight, fire-demon).
- **Art style**: cute chibi · anime pixel · dark fantasy · retro SNES · GBA · HD-2D ·
  grimdark · cartoon · hand-painted pixel · neon cyberpunk · low-palette (4/8-colour) ·
  Diablo-like · MapleStory-like · Metal-Slug.
- **Pixel size**: 16 · 24 · 32 · 48 · 64 · 96 · 128 (bosses bigger than the cast). Keep the
  whole cast on ONE tier (mixing reads as inconsistent) — see §0a resolution table.
- **Theme / biome**: cave · forest · swamp · snow · volcano · desert · ruins · dungeon ·
  haunted castle · space station · cyber city · underwater · heaven/hell · shrine · town.
- **Animation set** (per character): idle · walk · run · dash · jump · double-jump ·
  attack-combo · cast · hurt · die · roll · climb · swim · shoot · charge. List exactly the
  ones the game uses (don't generate frames you'll never play).
- **Asset types** to produce: character spritesheet · enemy pack · boss reference · tileset/
  map · UI icons · skill VFX · weapon pack · NPC pack · mounts/pets · portrait sheet · emote
  pack · parallax background · environment props.

A strong prompt names them all, e.g.:
> "Pixel Art **Necromancer** spritesheet, **dark fantasy**, **side-scroller**, **32×32**,
> **idle/walk/cast/die**, purple-green magic VFX, **dungeon** theme, transparent background,
> uniform grid, no text/labels."
> "**Cyberpunk samurai**, **neon-blue palette**, **64×64**, **side view**, attack-combo
> spritesheet, katana slash VFX, transparent background, uniform grid."

### Map / environment — plan it as its own layered set (not one image)

A map is NEVER one picture — it's a **layered set**, and the plan must break it out so the
tiles actually compose in-engine:

- **Layers:** parallax background (far mountains / clouds / moon / cave depth) → midground
  → **terrain tileset** → props/decorations → interactive objects → hazards → environment
  VFX → foreground/lighting overlay.
- **Terrain tiles:** ground · cliff · wall · slope · bridge · platform (must tile
  seamlessly; for a side-scroller demand a top/fill/left-edge/right-edge/platform set).
- **Decorations:** tree · bush · crystal · torch · skull · bones · mushroom · lantern ·
  banner. **Interactive:** door · lever · chest · checkpoint · elevator · trap · ladder.
  **Hazards:** spike · lava · acid · falling rock · saw blade. **Env FX:** fog · rain ·
  snow · dust · fire embers · magic particles.
- **Biome** (pick + theme everything to it): fantasy/medieval (forest · dark forest ·
  castle · dungeon · cave · village · graveyard · cathedral · ruins · throne room) ·
  nature/survival (swamp · snow mountain · jungle · desert · volcano · river · beach ·
  underwater · mushroom) · dark/horror (blood cave · haunted mansion · hell · toxic sewer ·
  abandoned lab) · sci-fi/cyberpunk (neon city · space station · alien planet · factory ·
  lab · mecha battlefield) · japanese/asian (samurai village · bamboo forest · shrine ·
  yokai · dojo · castle) · platformer-specific (precision-jump · trap dungeon · lava ·
  ice-slippery · moving-platform · minecart cave).
- **Map style:** retro (NES/SNES/GBA) · modern pixel (HD-2D/Octopath · Dead-Cells ·
  Blasphemous · Celeste · Terraria-inspired) · palette (4-colour GameBoy · limited · neon ·
  dark-muted). **Tile size:** 8 (retro) · 16 (RPG) · 24 (mobile-light) · **32 (platformer
  default)** · 48 (detailed) · 64 (HD) — keep it the same across the whole map.
- For depth, consider **biome progression / boss biome / seasonal / metroidvania layout** —
  plan tiles as **modular, reusable** pieces (one set, re-skinned per biome) so a few
  generations cover many screens.

A strong map prompt, e.g.:
> "Pixel Art **Cave Tileset**, **32×32**, **side-scroller platformer**, animated torches,
> crystals, ladders, platforms, **parallax background**, **dark fantasy**, seamless,
> transparent background, uniform grid, no text."
> "Pixel Art **Forest Map** assets, vibrant fantasy biome, **32×32 tileset**, trees, grass,
> bridges, ruins, animated waterfall, **side-view platformer**, seamless, transparent bg."

Then write an **`ASSET-PLAN.md` in the game folder** so the work is explicit and the user
can act on it. **Copy `templates/ASSET-PLAN-TEMPLATE.md`** (next to this skill) as the
starting point — it's the worked example with copy-paste ChatGPT/Gemini prompts already
written; fill its placeholders. Its shape:

1. **Image report** — a table of every sprite/tile/bg/FX/UI icon the game needs (heroes,
   each enemy, boss, every tile skin per level, hazards, props, parallax backgrounds,
   projectiles, HUD icons, logo), **with a NOTES column per asset** (frame count, facing,
   size, colour/mood, animation states).
2. **Audio report** — plan the **5 audio systems** (BGM, SFX, ambient, voice/grunts,
   dynamic music — see `phaser-audio` §0), as a table of every track/clip **with a NOTES
   column per sound** (length, tone, when it plays): music per context (menu/gameplay/
   boss) in a style matching the era; SFX grouped character/combat/environment/UI/enemy
   (footstep, jump, each attack, hit, hurt, death, pickup, level-clear, boss roar/defeat,
   menu blips); an ambient bed; optional grunts. Reuse the `phaser-audio` rules
   (dual-format `.m4a`+`.ogg`, throttle, ±10% pitch, mixing/headroom, iOS).
2b. **UI/UX report** — list the screens the game needs (HUD, menu, inventory, skill,
   dialogue, shop, pause) + the UI asset pack (buttons/panels/bars/icons/damage-font/
   boss-bar) + a note on the 4 UX pillars (combat feedback, input feel, visual hierarchy,
   readability). Pick a UI style matching the era/theme. Full guidance: **`phaser-ui-ux`
   §0** — plan the UI here, then build it bug-free per that skill's §1+.
3. **Image-generation prompts**, one per row, IN REPORT ORDER, ready to paste into
   ChatGPT/DALL·E/Gemini. **Every prompt must name the pinned art-direction axes**
   (archetype + art-style + camera/perspective + pixel-size + theme/biome + the exact
   animation set), AND force a *cuttable* output: **uniform grid, equal transparent
   padding, transparent (or solid magenta `#FF00FF`) background, NO text/labels/palette
   swatches, no baked drop-shadow**, fixed cell size, the bit-era, view + facing, one
   animation per row. Tell the user to **generate the first hero, lock the style, then
   say "same style as the previous sheet"** in later prompts for cohesion; prefer **one
   sheet per animation** (easier to re-roll + cut). (Pretty "concept sheets" with
   title+palette+turnaround are NOT cuttable — that's the trap that made the first refs
   unusable.)
3b. **Self-check the prompts for a CONSISTENT perspective before handing them over.** The
   single most common incoherence is **mismatched camera/view across sheets** — e.g. the
   ship prompt says "top-down" but the asteroid/star/FX prompts omit it (the AI then draws
   some sprites side-on, some from above, and they clash in-game). Re-read EVERY image
   prompt and confirm: (a) each one states the SAME perspective as the art-direction
   (`top-down` / `side view` / `3/4` …) explicitly in its body; (b) the **lighting phrase
   matches** — `top-down lighting` for top-down, `top-left light` for side/3-4 (a
   "top-left light" line in a top-down prompt is a tell that it drifted to side-view);
   (c) view-specific cues are present and consistent (top-down ship = "nose up", top-down
   scroller bg = "seamless VERTICALLY"; side-scroller = "facing right", "seamless
   horizontally"). Fix any prompt that omits or contradicts the view. This is a quick
   grep-and-eyeball, but skipping it ships a cast that doesn't share one camera.
4. **Audio-generation prompts**, one per row, in report order (for ElevenLabs SFX /
   Suno-Udio music) — and note these double as search terms for free CC0 audio
   (Kenney/freesound/OpenGameArt), which you should check FIRST before generating.
5. **Extra recommendations** — free-asset-first, one shared palette across the cast,
   where to drop the finished PNGs (`D:/Github/0assets/<game>/`) so they can be sliced
   (`slice-spritesheet.mjs`) + pixelated (`pixelate.mjs`) and wired in.

Do this BEFORE building gameplay for any non-trivial game, or at minimum when the user
asks "what assets does this need" / "make prompts to generate art". The plan is also what
keeps art cohesive and prevents the "vẽ quá xấu / mismatched" outcome.

## 0e. Full game-systems checklist — what a complete game has (and which skill owns it)

A modern indie/pixel game is ~40 systems across 12 areas. You don't build them all for
every game — **scope to the genre + core loop** — but run this checklist when planning so
nothing important is missed, and so you know which sibling skill carries each piece. Mark
each row in-scope / later / N-A for the game at hand.

- **I. Foundation** — genre · core gameplay loop · perspective/camera · art direction.
  → `game-design` §1 (loop/pacing) + §0d above (perspective + art direction).
- **II. Character** — main-char design (silhouette/hitbox/hurtbox/anchor) · animation set
  (idle/walk/run/jump/fall/attack/hurt/die + dash/roll/climb/combo/cast) · combat (melee
  combo/hitstun/cancel/knockback · ranged projectile/charge/spread · magic cast/mana/AoE/
  buff) · skill system (active/passive/ultimate/tree) · progression (EXP/level/stat-growth/
  unlocks). → `game-design` §2 (anim) + §3/§4 (combat feel/telegraph); pool projectiles
  (`Pool`); progression/skill-tree = your own `systems/` modules (data-driven).
- **III. Enemy** — archetypes (melee/archer/flying/tank/summoner/assassin/mage) · AI
  (patrol/chase/range/dodge/retreat as a small **state machine**) · boss (intro/multi-
  phase/arena mechanic/weak-point/enrage). → `game-design` §4 (readability/telegraph);
  AI = a simple per-enemy state enum in `update()`, boss phases = HP-threshold switches.
- **IV. Map/world** — tileset · biome · level design (spacing/secrets/enemy placement/
  checkpoint) · world structure (linear / metroidvania semi-open / roguelike procedural).
  → §0c (data-array levels; Tiled only if map-heavy) + §0d map plan.
- **V. VFX/feel** — visual effects (slash/fire/ice/smoke/dust/blood/explosion) · **juice**
  (shake/hit-stop/flash/recoil/slow-mo/zoom) · lighting (glow/bloom/day-night). → `game-
  design` §3 juice table + §9 VFX anatomy; lighting in Phaser = additive-blend overlays /
  `Light2D` pipeline (use sparingly on pixel games — a dark overlay + glow sprites is
  cheaper and reads better than a full light system).
- **VI. Audio** — BGM · SFX · ambient · voice/grunts · dynamic music. → `phaser-audio` §0.
- **VII. UI/UX** — HUD · menu · inventory · skill UI · dialogue · shop · pause; the 4 UX
  pillars. → `phaser-ui-ux` §0 (plan) + §1+ (bug-free build).
- **VIII. Story/content** — narrative (dialogue/lore/quest/cutscene) · NPC (shop/quest-
  giver/companion). → `game-design` §7; dialogue UI = `phaser-ui-ux`.
- **IX. Tech** — physics (gravity/collision/friction/velocity = Arcade) · save (slot/
  checkpoint/autosave) · camera (smooth-follow/deadzone/shake/zoom) · input (keyboard/
  controller/rebind/touch) · optimization (atlas/pooling/culling/chunking). → Arcade
  physics (template); **save = localStorage mirror of the registry** (`phaser-review`
  gameplay-data section — registry is RAM-only); camera = `cameras.main.startFollow` +
  `setDeadzone` + `shake`; input/touch = `phaser-perf-audit` §6a; optimization =
  `phaser-optimize-bundle` + `phaser-perf-audit`.
- **X. Production** — asset pipeline (concept→sprite→animate→export→integrate) · file
  organization (the `games/<name>/src/{scenes,objects,systems,types}` convention) · source
  control (git; branch → PR → wait for the user's OK to merge). → §0 conventions + §0d
  pipeline.
- **XI. Release** — QA (collision/softlock/FPS/UI bugs) · marketing (out of scope) ·
  deploy (the static hub auto-builds; GitHub Pages). → `phaser-smoketest` (QA gate) + §2b
  hub + Steps.
- **XII. Live (optional)** — online (co-op/PvP/ranking) · analytics. → only if asked;
  twdc-defense's leaderboard (Cloudflare Worker + KV, `phaser-review`) is the reference.

**The strong modern indie combo** (recommend when the user is open): side-scroller ·
32–48px · roguelike+metroidvania structure · fast responsive combat · modern pixel art +
light touches · minimal clean UI · layered SFX · juice (hit-stop + particles + shake) ·
bosses + secrets + progression. Scope DOWN from this to fit the actual request.

## 1. Steps

1. **Ask the game name** (kebab-case) if not given. Path becomes `games/<name>/`. Also
   pin the **art direction** (§0d: perspective + archetype + style + pixel size + biome)
   and name the **core loop** (one sentence) — confirm with the user if unclear.
2. **🛑 PLAN THE ASSETS FIRST — write `ASSET-PLAN.md` and PAUSE (the §0d hard gate).** For
   any non-trivial game this comes BEFORE scaffolding. Copy `templates/ASSET-PLAN-
   TEMPLATE.md` → `games/<name>/ASSET-PLAN.md`, fill it (research the genre per §0b), and
   **post to the user**: the image report, the map report, the audio report (5 systems),
   the UI/UX report, and the copy-paste ChatGPT/Gemini generation prompts. Wait for the
   user to review / generate art before writing gameplay code. Do NOT proceed to step 3
   until the plan exists and the user has seen it.
3. **Ensure root tooling exists.** If `games/` or root `package.json` is missing, create the shared root from `templates/root/` (see below) first — this is a one-time bootstrap.
4. **Copy `templates/game/`** into `games/<name>/`, substituting:
   - `__GAME_NAME__` → the kebab name,
   - `__GAME_TITLE__` → a Title Case version (in `index.html` `<title>` **and** `game.json`),
   - `__DEV_PORT__` / `__PREVIEW_PORT__` → a unique port pair not used by another game (start at 5180/4180 and increment per game). Each game gets a **fixed `strictPort`** so dev servers in the monorepo never collide.
   - In `game.json`, optionally fill `description` and `tags` — the hub shows them on the game's card. Both are optional; an empty description/tags falls back to a title-only card.
5. **Wire the workspace**: add `games/<name>` to the root `package.json` `workspaces` array (if using npm workspaces) and add `dev:<name>` / `build:<name>` / `preview:<name>` scripts. No hub edit needed — `scripts/build-all.mjs` auto-discovers every `games/*` with a `vite.config.mjs` and regenerates the hub (`dist/index.html`) + deploys it, so a new game appears on the landing page automatically.
6. **Build the gameplay** — scenes/objects/systems per the core loop, using the planned
   assets (placeholder art is fine until the user's generated art lands; wire real art in
   when it arrives). Reference §0e for which systems the game needs.
7. **Install** (`npm install` at root) only if deps changed.
8. **Verify (Playwright) — the real "it works" gate, not optional.** Run the
   **`phaser-smoketest`** skill against the new game and report its full pass/fail
   table. A green run REQUIRES all of:
   - boots + canvas renders + console clean + FPS ≥ 55, **and**
   - **UI layout sound** — run its overlap/reachability probe on *every* scene and
     *every* overlay state (menu, gameplay, shop/build menu open, upgrade panel,
     pause, game-over/win): zero overlapping interactive controls, nothing
     off-screen, every visible button reachable. (This is the gate that catches a
     buy-shop covering the play/start button — boot+FPS alone will not.)
   - **Core gameplay loop proven** — drive the one-sentence loop end to end and
     assert the state changes (score/money/lives/health/wave). Add a dev-only hook
     if needed to do it deterministically.
   - **Every screenshot eyeballed** — `Read` each PNG back and judge it (overlap,
     occlusion, clipping, readability), not just save it.
   - **iOS-safe audio (if the game has sound)** — every clip has an `.m4a` next to its
     `.ogg`, `PreloadScene` loads `[m4a, ogg]` (m4a first), and the context resumes on
     gesture. MCP can't run Safari, but Ogg-only ships a silent iPhone — verify the
     files + load order exist. See `phaser-audio`.

   Do not report "it works" off a boot-only run. If the smoke-test surfaces an
   overlap/occlusion or a loop that doesn't advance, **fix it and re-verify** before
   calling the game done. Do not leave the dev server running unless asked.

## 2. Template files

The ready-to-copy templates live next to this skill under `templates/`. Read them, substitute placeholders, and write them into the new game folder. Key files and the *why*:

- **`config.ts`** — the single GameConfig. Pixel-art + Arcade + Scale.FIT + `render.powerPreference: 'high-performance'`. Scene list references `SceneKeys`.
- **`scenes/BootScene.ts`** — sets `this.scale` mode, loads only the loading-bar texture, then `start(PreloadScene)`.
- **`scenes/PreloadScene.ts`** — loads every atlas/audio, draws a progress bar off `this.load.on('progress')`, then `start(MenuScene)`.
- **`systems/Pool.ts`** — generic typed object pool wrapper around `Phaser.GameObjects.Group` with `spawn()`/`despawn()`. Re-used by every game.
- **`objects/PooledSprite.ts`** — base class that knows how to reset itself for the pool.
- **`game.json`** — hub card metadata: `{ title, description?, tags?[], thumb? }`. All optional except title; consumed by the hub.

## 2b. Hub conventions (static-HTML "COLLECTION" card grid)

The landing page is a **static HTML/CSS page** generated at build time by
`scripts/build-all.mjs` via `scripts/hub-template.mjs` (`renderHub`). It is NOT a
Phaser app — it's a dark "COLLECTION"-style grid of **pastel trading cards**, one per
game (responsive `auto-fill`, ~190px min, 1→6 cols; colors cycle through a pastel
palette so a new game auto-gets a color). Zero JS, no network font. Keep `src/pixel/`
(games) and `scripts/{build-all,hub-template}.mjs` in sync between the live repo and
`templates/root/`.

- **Game art** follows §0a (SVG by default; pixel only on request; research a verified free asset before drawing).
- **Card artwork** priority (per game): committed `games/<name>/cover.svg` (inlined) →
  `cover.png` (data-URI) → the pixel `game.json.thumb` rendered as **inline SVG** (via
  `gridToSvg`) → a default cabinet glyph. `thumb` is a `PixelGrid { grid, map }`
  (equal-length rows, hex/`null` map) — still authored with the `pixel-art` skill.
- **Card text** comes from `games/<name>/game.json` (`title`/`tags`; `description` →
  `aria-label`). Missing/malformed `game.json` never breaks the build — falls back to `<title>`.
- **`build-all.mjs`** builds each game (Vite) into `dist/<game>/`, resolves each card's
  artwork, then writes `dist/index.html` (the cards ARE the crawlable `<a>` content — no
  separate fallback needed) + `dist/.nojekyll`. A new game appears automatically.
- **Windows build**: run `build:all` via PowerShell or set base via env — Git Bash
  mangles a bare leading `/` (MSYS). Base comes through the `GAME_BASE` env, never `--base /`.

## 3. Anti-patterns to refuse

- Loading individual PNGs per sprite → use an atlas (point them to `phaser-optimize-bundle`).
- `new Bullet()` / `.destroy()` in `update()` → use the Pool.
- Importing all of Phaser into shared libs that don't need it (kills tree-shaking).
- Hardcoded canvas dimensions instead of `Scale.FIT` + relative sizing.
- **Virtual joystick that reads direction inside `pointermove`** → feels laggy on
  phones (move events fire less often than the frame loop and stop when the finger
  is held). Recompute `dx/dy` every frame in `sample()`/`update()` from the owning
  pointer, call `input.setPollAlways()`, and keep `touch-action: none` (already in
  the template `index.html`). Full checklist + Playwright verify in `phaser-perf-audit` §6a.

After scaffolding, mention the sibling skills: `game-design` (the core loop, juice & feel — read it when planning the game so it isn't "flat"), `pixel-art` (draw the game's sprites + hub thumbnail), `phaser-audio` (add CC0 sound + the throttled Audio helper), `phaser-optimize-bundle`, `phaser-perf-audit`, `phaser-review`.

> **Design before mechanics.** Before building gameplay, name the **core loop** in
> one sentence and decide where the **juice** goes (feedback per action) — see
> `game-design`. A technically-correct game with no loop/juice reads as "flat /
> bland / shallow".
