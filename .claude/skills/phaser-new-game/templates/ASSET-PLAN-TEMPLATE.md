# <GAME TITLE> — Asset Plan & Generation Prompts

> **Template.** Copy this to `games/<game>/ASSET-PLAN.md`, fill the angle-bracket
> placeholders, and prune rows the game doesn't use. It is the worked example for
> `phaser-new-game` §0d. Sections: art-direction → image report → audio report → UI/UX
> report → copy-paste image prompts → copy-paste audio prompts → recommendations.

---

## 0. Art direction (pin this FIRST — every prompt repeats it)

| Axis | Choice |
|------|--------|
| **Camera / perspective** | <side-scroller \| top-down \| isometric \| 3/4 \| beat-em-up \| tactical> |
| **Character archetype(s)** | <knight \| mage \| ninja \| … or a mix e.g. cyber-samurai> |
| **Art style** | <dark fantasy \| retro SNES \| neon cyberpunk \| cute chibi \| …> |
| **Pixel size** | <16 \| 24 \| 32 \| 48 \| 64> (bosses bigger) — keep the cast on ONE tier |
| **Theme / biome** | <forest \| cave \| dungeon \| neon city \| shrine \| …> |
| **Palette** | <e.g. limited 24-colour: deep purples, cyans, steel greys, warm skin> |
| **UI style** | <retro-NES \| SNES-RPG \| modern-indie minimal \| dark-fantasy> |

> Every image prompt below names ALL of these so the output stays cohesive and cuttable.

---

## 1. Image report

### 1A. Heroes (one row per animation; per `pixel-size`, facing per perspective)
| # | Asset | Frames | Notes |
|---|-------|--------|-------|
| 1 | <Hero> — idle | 4 | <appearance, facing, breathing bob> |
| 2 | <Hero> — walk/run | 6 | <stride cycle> |
| 3 | <Hero> — jump | 4 | crouch→launch→apex→fall (squash/stretch) |
| 4 | <Hero> — attack/cast | 5 | wind-up→strike→recovery (+ projectile if ranged) |
| 5 | <Hero> — hurt + death | 2+4 | flinch; topple/fade |

### 1B. Enemies + boss
| # | Asset | Frames | Notes |
|---|-------|--------|-------|
| 6 | <Enemy A> | 4 | <behaviour, facing> |
| 7 | <Enemy B> | 4 | … |
| 8 | <Boss> | 4+4 | idle/hover + attack pose; bigger cell |

### 1C. Tiles & props (per biome / per level skin)
| # | Asset | Notes |
|---|-------|-------|
| 9  | Ground tile (<biome>) | seamless top/fill/edges |
| 10 | Platform tile | floating variant |
| 11 | Spikes / hazard | <hazard type> |
| 12 | Exit flag / checkpoint | level goal |
| 13 | Decor (crystal/torch/…) | background sparkle |
| 14 | Parallax background (<biome>) | wide, seamless horizontally |

### 1D. FX & UI icons
| # | Asset | Notes |
|---|-------|-------|
| 15 | Slash / attack FX | additive glow, 3 frames |
| 16 | Projectile / spell bolt | glowing orb + trail |
| 17 | Hit spark | impact burst, 3 frames |
| 18 | Heart / HP pip | full + empty |
| 19 | UI panel + button | per UI style (nineslice-friendly) |
| 20 | Title logo | menu (optional) |

---

## 2. Audio report (5 systems — see `phaser-audio` §0)

| # | Sound | System | Notes (length · tone · when) |
|---|-------|--------|------------------------------|
| M1 | Menu / exploration theme | BGM | loop, <style>, ~60–90s |
| M2 | Boss theme | BGM | loop, darker/faster |
| S1 | Footstep | SFX·character | ~0.2s, low, frequent |
| S2 | Jump | SFX·character | ~0.25s |
| S3 | Attack / cast | SFX·combat | ~0.3s |
| S4 | Hit / impact | SFX·combat | meaty, ~0.3s |
| S5 | Enemy hurt / death | SFX·enemy | shared + pitch-shift |
| S6 | Player hurt / death | SFX·character | grunt + sting |
| S7 | Pickup | SFX·UI | bright chime |
| S8 | Level clear / win | SFX·UI | fanfare |
| S9 | Menu select | SFX·UI | blip |
| A1 | Ambient bed (<wind/cave/rain>) | ambient | low loop under music |
| V1 | Grunts / shouts (optional) | voice | "hah!"/"ugh!" |

---

## 3. UI/UX report (see `phaser-ui-ux` §0)

- **Screens:** <HUD · main menu · pause · (inventory · skill · dialogue · shop if used)>.
- **HUD layout:** <e.g. HP top-left, skills bottom, boss bar top-centre>.
- **UI asset pack:** buttons · panels · bars · icons · damage-font · boss HP bar.
- **4 UX pillars:** combat feedback (flash+shake+sound+number+hit-stop+particles) · input
  feel (coyote+buffer, responsive) · visual hierarchy (enemy→danger→skill→HP→loot) ·
  readability (contrast/outline/silhouette; FX never cover gameplay).

---

## 4. Image-generation prompts (copy/paste into ChatGPT / DALL·E / Gemini, in report order)

> Each forces a **cuttable** sheet: uniform grid, equal transparent (or magenta #FF00FF)
> padding, NO text/labels/palette/shadow, fixed cell, the bit-era, view + facing, one
> animation per row. Generate the FIRST hero, lock the style, then reuse "same style as
> the previous sheet". Prefer one sheet per animation.

### Prompt 01 — <Hero> (master sheet)
```
Pixel art character sprite sheet, <art style>, <16-bit SNES>, <camera/perspective>,
facing <right/down>. Subject: <hero description — outfit, weapon, hair, mood>.
Output a clean SPRITE SHEET on a fully TRANSPARENT background (or solid magenta #FF00FF
if transparency is unavailable). Each frame exactly <32x32> pixels, strict uniform grid
with equal transparent padding, no frame touching another. NO text, NO labels, NO palette
swatches, NO drop shadow under the feet.
Rows: Row 1 IDLE (4), Row 2 WALK (6), Row 3 JUMP (4: crouch/launch/apex/fall),
Row 4 ATTACK (5: wind-up/swing/strike/follow-through/recover).
Crisp hard-edged pixels, no anti-aliasing, limited cohesive <palette>, single light from
top-left, consistent character size + ground line across all frames.
```

### Prompt 02 — <Hero B / Magician> (match the first)
```
Pixel art character sprite sheet, SAME pixel style, palette, outline weight and top-left
lighting as the previous sheet. <camera/perspective>, facing <right/down>.
Subject: <2nd hero description>. Clean SPRITE SHEET, TRANSPARENT (or magenta #FF00FF),
each frame <32x32>, strict uniform grid, equal padding, no frame touching, NO text/labels/
palette, no baked shadow. Rows: IDLE (4) / WALK (6) / JUMP (4) / CAST (5: raise, charge,
release — a glowing bolt leaves on the last frames). Crisp, no anti-aliasing, top-left light.
```

### Prompt 03 — <Enemy>
```
Pixel art enemy sprite sheet, <art style>, <perspective>, facing <left>, SAME style/palette
as the hero sheets. Subject: <enemy>. Animation: <4-frame loop>. Transparent (or magenta
#FF00FF), each frame <32x32>, uniform grid, equal padding, no text/labels/shadow. Crisp,
no anti-aliasing, top-left light.
```

### Prompt 04 — <Boss>
```
Pixel art boss sprite sheet, <art style>, <perspective>, facing <left>, SAME palette family
but larger + more menacing. Subject: <boss>. Row 1 IDLE/HOVER (4), Row 2 ATTACK (4).
Each frame <64x64>, uniform grid, equal transparent padding, TRANSPARENT (or magenta
#FF00FF), no text/labels/shadow. Crisp, dramatic top-left light + self-glow.
```

### Prompt 05 — Tileset (<biome>)
```
Pixel art seamless platformer TILESET, <art style>, <perspective>, <32x32> tiles. Theme:
<biome — e.g. dark arcane stone bricks with glowing runes + glowing moss top edge>.
A small set on TRANSPARENT (or magenta #FF00FF) in a uniform grid: 1) top tile, 2) fill,
3) left edge, 4) right edge, 5) floating platform. Tiles tile seamlessly L-R + stack
vertically. No text/labels. Crisp, no anti-aliasing, cohesive palette, top-left light.
```

### Prompt 06 — Parallax background (<biome>)
```
Pixel art PARALLAX BACKGROUND, <art style>, wide, seamless horizontally (left edge matches
right). Mood: <e.g. misty forest at cool-blue dusk, layered hills>. NO characters, NO
ground platforms (background only), NO text. Crisp pixels, cohesive <palette>.
```

### Prompt 07 — FX & HUD
```
Pixel art game FX + UI icons, <art style>, TRANSPARENT (or magenta #FF00FF), each on its
own cell in a uniform grid, no text:
1) 3-frame <colour> SLASH arc (additive glow), 2) glowing PROJECTILE orb + trail,
3) 3-frame HIT SPARK burst, 4) HEART icon (full + empty, 16x16 each),
5) a UI PANEL + BUTTON in <UI style>.
Crisp, no anti-aliasing, bright FX colours, top-left light.
```

---

## 5. Audio-generation prompts (copy/paste; also use as CC0 search terms — check free first)

```
M1 Exploration theme — looping <8-bit / 16-bit SNES / orchestral-chiptune> track,
<mysterious/adventurous>, medium tempo, seamless loop ~60-90s. Theme: <…>.
M2 Boss theme — looping intense battle track, darker + faster, driving percussion,
seamless loop ~60-90s.
S1 Footstep — soft short step on <stone>, dry, ~0.2s.
S2 Jump — quick upward whoosh/blip, ~0.25s.
S3 Attack/cast — <metallic swing / magical whoosh + sparkle>, ~0.3s.
S4 Hit — meaty impact with a little crunch, ~0.3s.
S5 Enemy death — defeated crumble/poof, ~0.5s.
S6 Player hurt — short pained grunt + sting, ~0.4s.
S7 Pickup — bright collect chime, ~0.3s.
S8 Level clear — short triumphant fanfare, ~1.5s.
S9 Menu select — clean UI confirm blip, ~0.15s.
A1 Ambient — low looping <wind/cave-drip/rain> bed, ~10-30s seamless.
```
> Free CC0 first: Kenney Audio · freesound.org (CC0 filter) · OpenGameArt. Ship dual-format
> **`.m4a` + `.ogg`** and load `[m4a, ogg]` (iOS can't decode Ogg) — see `phaser-audio`.

---

## 6. Recommendations

- **Free-asset-first:** check Kenney / OpenGameArt / itch.io "free" before generating.
- **Lock the style:** generate the first hero, then reuse "same style as the previous sheet".
- **One sheet per animation** (easier to re-roll + cut) and ALWAYS demand transparent/
  magenta bg + no text + uniform grid — that's what makes a sheet cuttable.
- **One shared palette** across heroes/enemies/tiles for cohesion.
- **Drop finished PNGs** in `D:/Github/0assets/<game>/` → slice (`scripts/slice-spritesheet.mjs`)
  + pixelate (`scripts/pixelate.mjs`) → wire into the game.
