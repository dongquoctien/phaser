# Cave Collector — Asset Plan & Generation Prompts

> Side-scroller pixel platformer: a flower-haired explorer runs/jumps through a glowing
> toxic cave — punch ? blocks, grab every star, dodge spinning shuriken + sentry-bots,
> reach the exit door. The game already runs on hand-baked char-grid art (placeholder);
> this plan is the prompt set to **regenerate the cast + tiles as proper sprite sheets**
> (characters should NOT stay as hand-typed grids — §0b).

## 0. Art direction

| Axis | Choice |
|------|--------|
| **Camera / perspective** | Side-scroller (platformer) |
| **Character archetype** | Cute explorer girl (flower in hair) · sentry-bot enemy · shuriken hazard |
| **Art style** | Modern-indie pixel, glowing toxic-cave (Hollow-Knight/Celeste-ish readability) |
| **Pixel size** | 32×32 cast · 16×16 tiles · bigger for the door |
| **Theme / biome** | Toxic / glowing cave (sickly greens + cyan glow + dark rock) |
| **Palette** | dark slate rock · toxic green (#5ac54f-ish) · cyan glow · warm skin · pink flower |
| **UI style** | Retro-NES minimal (pixel font, simple bars), high contrast over the dark cave |

## 1. Image report

### 1A. Hero — "explorer girl" (32×32, faces right)
| # | Asset | Frames | Notes |
|---|-------|--------|-------|
| 1 | Hero — idle | 4 | flower in hair, satchel; breathing bob |
| 2 | Hero — run | 6 | full stride |
| 3 | Hero — jump | 3 | crouch → launch → fall (squash/stretch) |
| 4 | Hero — punch | 3 | upward fist to hit the ? block |
| 5 | Hero — hurt | 2 | flinch (knockback handled in code) |

### 1B. Enemies & hazards
| # | Asset | Frames | Notes |
|---|-------|--------|-------|
| 6 | Sentry-bot (robot) | 4 | hovering/patrolling bot, single red eye; faces left |
| 7 | Shuriken | 4 | spinning metal star hazard (rotation loop) |

### 1C. Tiles & props (16×16, toxic-cave biome)
| # | Asset | Notes |
|---|-------|-------|
| 8  | Ground tile | dark cave rock top + toxic-moss glowing edge, seamless |
| 9  | Inner/fill tile | darker rock body |
| 10 | ? block (unhit) | glowing question block to punch |
| 11 | Block — used | dimmed/cracked after hit |
| 12 | Exit door | glowing cave door (the level goal), ~32×48 |
| 13 | Crystal / mushroom decor | background glow props |
| 14 | Parallax background | layered cave depth, faint cyan glow, dripping silhouettes |

### 1D. Collectibles, FX & HUD
| # | Asset | Notes |
|---|-------|-------|
| 15 | Star (collectible) | spinning glowing star, ~6-frame spin |
| 16 | Coin | spinning coin, 4-frame spin |
| 17 | Hit spark / poof | impact burst when punching a block / hitting a bot |
| 18 | Heart | HP pip, full + empty |
| 19 | Pixel font / number set | HUD score/stars/lives digits (or reuse a bitmap font) |

## 2. Audio report (5 systems — see `phaser-audio` §0)

| # | Sound | System | Notes |
|---|-------|--------|-------|
| M1 | Cave exploration theme | BGM | loop, mysterious + a little eerie, medium tempo, ~60–90s |
| M2 | Tension/near-exit sting | BGM (optional) | short loop variation |
| S1 | Footstep | SFX·character | soft, on stone, ~0.2s, frequent (throttle) |
| S2 | Jump | SFX·character | quick blip, ~0.25s |
| S3 | Land | SFX·character | small thud |
| S4 | Punch / block hit | SFX·combat | pop + a "ding" when a ? block pays out |
| S5 | Star pickup | SFX·UI | bright sparkle chime |
| S6 | Coin pickup | SFX·UI | classic coin blip |
| S7 | Hurt | SFX·character | short grunt + sting |
| S8 | Bot/shuriken hit | SFX·enemy | metallic clank |
| S9 | Level clear (reach door) | SFX·UI | triumphant fanfare ~1.5s |
| S10 | Game over | SFX·UI | descending defeat jingle |
| S11 | Menu select | SFX·UI | blip |
| A1 | Cave ambient bed | ambient | low loop: drips + faint hum |

## 3. UI/UX report (see `phaser-ui-ux` §0)

- **Screens:** Menu · HUD · Game-over / Level-cleared overlay.
- **HUD layout:** score top-left, **stars collected** top-centre, lives (hearts) top-right
  — minimal, high-contrast over the dark cave.
- **UI asset pack:** number font, heart pip, star icon, a thin panel for overlays.
- **4 UX pillars:** combat feedback (punch → spark + ding + small shake + coin pop) ·
  input feel (coyote time + jump buffer already in Hero) · visual hierarchy (glowing
  collectibles + red-eyed bots pop against dark rock) · readability (strong contrast;
  hazards clearly a different colour from props — shuriken metallic, not green).

## 4. Image-generation prompts (copy/paste into ChatGPT / DALL·E / Gemini, in report order)

> Each forces a **cuttable** sheet: uniform grid, equal transparent (or magenta #FF00FF)
> padding, NO text/labels/palette/shadow, fixed cell, 16-bit era, side view + facing,
> one animation per row.

### Prompt 01 — Hero (explorer girl, master sheet)
```
Pixel art character sprite sheet, modern indie 16-bit, side-scroller, facing right.
Subject: a cute young explorer girl with a pink FLOWER in her hair, short tunic + small
satchel, brave expression. Output a clean SPRITE SHEET on a fully TRANSPARENT background
(or solid magenta #FF00FF). Each frame exactly 32x32 pixels, strict uniform grid, equal
transparent padding, no frame touching. NO text, NO labels, NO palette swatches, NO drop
shadow under the feet.
Rows: Row 1 IDLE (4, breathing), Row 2 RUN (6, full stride), Row 3 JUMP (3: crouch,
launch, fall), Row 4 PUNCH (3: wind-up, upward fist, recover).
Crisp hard-edged pixels, no anti-aliasing, cohesive palette (warm skin, pink flower,
earthy tunic), single light from top-left, consistent size + ground line across frames.
```

### Prompt 02 — Sentry-bot enemy
```
Pixel art enemy sprite sheet, SAME pixel style + top-left lighting as the hero sheet.
16-bit side view, facing left. Subject: a small hovering SENTRY-BOT with one glowing red
eye, metal plating, little thrusters. Animation: 4-frame hover/patrol loop (eye glow
pulse + slight bob). Clean SPRITE SHEET, TRANSPARENT (or magenta #FF00FF), each frame
32x32, strict uniform grid, equal padding, NO text/labels/shadow. Crisp, no anti-aliasing.
```

### Prompt 03 — Shuriken hazard
```
Pixel art hazard sprite sheet, 16-bit, SAME style. Subject: a sharp metal SHURIKEN
(throwing star), cold steel with a glint. Animation: 4-frame full SPIN/rotation loop.
TRANSPARENT (or magenta #FF00FF), each frame 24x24, uniform grid, equal padding, no
text/labels/shadow. Crisp, no anti-aliasing, top-left light.
```

### Prompt 04 — Toxic-cave tileset
```
Pixel art seamless platformer TILESET, modern indie 16-bit, side view, 16x16 tiles.
Theme: a glowing TOXIC CAVE — dark slate rock with a sickly toxic-green glowing moss top
edge and faint cyan glow. A small set on TRANSPARENT (or magenta #FF00FF) in a uniform
grid: 1) ground top tile, 2) inner/fill rock, 3) left edge, 4) right edge, 5) a floating
platform piece. Tiles tile seamlessly left-right + stack vertically. No text/labels.
Crisp, no anti-aliasing, cohesive dark-rock + toxic-green palette, top-left light.
```

### Prompt 05 — Blocks, door & decor
```
Pixel art platformer props, 16-bit, SAME cave palette, TRANSPARENT (or magenta #FF00FF),
each on its own cell in a uniform grid, no text:
1) a glowing "?" QUESTION BLOCK to punch (16x16),
2) the SAME block used/dimmed/cracked after a hit (16x16),
3) a glowing cave EXIT DOOR, ancient stone arch with cyan light inside (32x48),
4) small glowing CRYSTAL + MUSHROOM decor for the background (16x16 each).
Crisp, no anti-aliasing, top-left light + self-glow on the door/crystals.
```

### Prompt 06 — Collectibles, FX & HUD
```
Pixel art game collectibles, FX + UI icons, 16-bit, TRANSPARENT (or magenta #FF00FF),
each on its own cell in a uniform grid, no text:
1) a glowing STAR collectible, 6-frame spin loop,
2) a gold COIN, 4-frame spin loop,
3) a 3-frame white/yellow HIT SPARK / poof burst,
4) a red HEART icon (full + empty, 16x16 each).
Crisp, no anti-aliasing, bright saturated collectible colours that pop on dark rock.
```

### Prompt 07 — Parallax background
```
Pixel art PARALLAX BACKGROUND, modern indie 16-bit, wide, seamless horizontally (left
edge matches right). Mood: a deep glowing TOXIC CAVE — layered rock-wall silhouettes,
faint cyan glow, distant dripping stalactites, subtle green haze. NO characters, NO
ground platforms (background only), NO text. Crisp pixels, cohesive dark + cyan palette.
```

## 5. Audio-generation prompts (copy/paste; also use as CC0 search terms — check free first)

```
M1 Cave theme — looping 16-bit / chiptune track, mysterious and slightly eerie, medium
tempo, light percussion, hints of danger, seamless loop ~60-90s. Theme: exploring a
glowing toxic cave.
S1 Footstep — soft short step on stone, dry, ~0.2s.
S2 Jump — quick upward blip, ~0.25s.
S3 Land — small soft thud, ~0.2s.
S4 Punch/block — a punchy pop + a bright "ding" payout, ~0.3s.
S5 Star pickup — bright sparkle chime, ~0.3s.
S6 Coin pickup — classic short coin blip, ~0.2s.
S7 Hurt — short pained grunt + tense sting, ~0.4s.
S8 Bot hit — metallic clank, ~0.3s.
S9 Level clear — triumphant fanfare, ~1.5s, chiptune.
S10 Game over — descending defeat jingle, ~1s, chiptune.
S11 Menu select — clean UI confirm blip, ~0.15s.
A1 Cave ambient — low looping bed: water drips + faint hum, ~15-30s seamless.
```
> Free CC0 first: Kenney Audio · freesound.org (CC0 filter) · OpenGameArt. Ship dual-format
> **`.m4a` + `.ogg`** and load `[m4a, ogg]` (iOS can't decode Ogg) — see `phaser-audio`.

## 6. Recommendations

- **Free-asset-first:** the cave tilesets on OpenGameArt / itch.io "free" (e.g. "Cute Caves
  Platformer Tileset", various CC0 cave packs) may drop in directly — check before generating.
- **Lock the style:** generate the HERO first, then "same style as the previous sheet" for
  the bot/shuriken/tiles so the cast is cohesive.
- **One shared palette** (dark rock + toxic green + cyan glow + warm skin) across all sheets.
- **Drop finished PNGs** in `D:/Github/0assets/cave-collector/` → slice
  (`scripts/slice-spritesheet.mjs`) + pixelate (`scripts/pixelate.mjs`) → replace the
  current hand-baked char-grid textures in `src/systems/textures.ts`.
