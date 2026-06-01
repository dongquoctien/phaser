---
name: game-design
description: Design the FEEL of a game — core loop & pacing, juice (screen shake, hit-stop, squash/stretch, particles, color flash, damage numbers), animation principles, sound feedback, enemy telegraphing/readability, and onboarding. Use when a game "feels flat / boring / không có chiều sâu / nhạt / thiếu cảm giác", when building combat/feedback, or when planning a new game's loop & progression. The design counterpart to the technical phaser-* skills.
---

# Game Design — Feel, Loop, Juice (this monorepo)

The `phaser-*` skills make a game **run** (perf, bundle, structure). This skill makes
it **feel good to play**. Reach for it when a game is technically fine but "nhạt /
flat / không có chiều sâu" — usually it's missing a tight core loop, readable
combat, and **juice** (feedback per action).

Distilled from public references (see `sources.md`): Jonasson & Purho "Juice it or
lose it", the 12 principles of animation, GDC/Game Developer combat & telegraphing
articles, indie sound-design guides, and onboarding/FTUE writing. **All guidance
here is authored from those public sources — not copied from any other repo.**

> Apply alongside the technical skills: `pixel-art`/SVG for the art, `phaser-audio`
> for the sound pipeline, `phaser-perf-audit` for staying at 60fps while juicing
> (pool particles!), `phaser-smoketest` to verify.

---

## 1. Core loop & pacing (the skeleton — decide this FIRST)

A game is a **short repeatable loop** the player wants to run again. Name it in one
sentence before building: e.g. *aim → fire → enemies die + drop XP → level up → pick
a build modifier → harder wave* (survivor/dungeon-pets). If you can't say the loop,
the game will feel aimless.

- **Loop length**: keep the inner loop **seconds**, the meta loop **1–3 minutes**.
  Get the player to the fun in the **first 30 seconds**, not after a menu marathon.
- **"Difference in kind, not just scale."** Upgrades that *change how you play*
  (multishot → pierce → ricochet) create depth; flat `+10% damage` does not. A run's
  picks should **compound** into a build (synergy), and the player should *feel* a
  decision. This is exactly what flipped dungeon-pets from "flat" to fun.
- **Difficulty curve = staircase, not a ramp**: escalate, then **plateau** (let the
  player feel strong), then a **spike** (boss). Endless games scale geometrically but
  must keep heals/power gains ahead of enemy growth or the player just dies to a wall.
- **Reward schedule**: frequent small rewards (XP ticks, coins) + rare big ones
  (level-up choice, boss drop, a pet joining). Never let a kill produce *only* a
  counter going up — pair it with a particle + sound + number (see §3).
- **Player agency**: a choice every ~20–40s (level-up pick, lane to push) keeps
  engagement. Pure idle with no decisions reads as "boring".

## 2. Animation principles for sprites (the 12, the ones that matter in 2D)

Even single-image sprites can move expressively via **tweens** — you don't need
frame-by-frame. The high-value principles for this repo's games:

- **Squash & stretch** (10–20% scale): the #1 life-giver. Scale a sprite to `1.15×`
  on a hop/jump/fire and yoyo back over ~100ms. Frog hop, hero fire, coin pickup.
- **Anticipation**: a tiny wind-up *before* a big action (pull back, crouch). Also
  how you make enemy attacks fair (see §4 telegraphing).
- **Slow in / slow out (easing)**: never move linearly for organic motion. Use
  `Quad.easeOut` for impacts, `Back.easeOut` for pops, `Sine` for idle bob. Linear is
  only for constant-velocity things (projectiles, conveyor).
- **Follow-through / overlap**: secondary bits (cape, tail, ears, a held item) lag
  the main move by 1–2 frames / a chained tween. A barely-delayed scale on a sub-part
  reads as weight.
- **Arcs**: jumps/throws follow a curve, not a straight line. Tween x linearly but y
  on an ease, or use a parabola.
- **Secondary action**: idle life — a slow breathing bob (`y ±2px`, 1.2s yoyo), blink,
  eyes that track the nearest enemy. Cheap, huge for "alive".
- **Exaggeration & appeal**: round shapes, big eyes, readable silhouette first
  (see `pixel-art`). Over-shoot the pose; reality is boring.
- **Timing**: fast actions = few ms (hit flash 60–80ms); settles = longer. Hold the
  end pose briefly so the eye registers it.

## 3. Juice — feedback per action (the biggest "feel" win, low effort)

> Jonasson/Purho: *"maximum output for minimum input."* Every meaningful action
> should answer with sight + sound. Layer several of these per event.

Concrete, code-implementable, with rough magnitudes:

| Technique | Magnitude / timing | When |
|---|---|---|
| **Screen shake** | camera offset **2–5px**, decay over **80–150ms** | impacts, explosions, taking damage, boss slam — scale amplitude by impact |
| **Hit-stop / freeze** | **2–8 frames** (~30–130ms) pause of the *involved* objects | on a heavy hit / crit / kill — sells weight. Don't freeze the WHOLE game every hit; scale by damage |
| **Squash & stretch** | **10–20%** scale, yoyo ~100ms | fire, hop, pickup, land |
| **Color flash** | white/red tint **60–120ms** then clear | on-hit (`setTint` + `TintModes.FILL`, then `clearTint`) |
| **Particle burst** | **5–20** pooled sprites, fade+scale out 150–400ms | kills, pickups, crits, level-up |
| **Knockback** | push target **10–50px** away from impact, ease back | melee/heavy hits |
| **Damage / floating numbers** | float **up ~24px**, fade over **0.6–1.2s**; crits bigger + gold | every damaging hit (optional but very juicy) |
| **Trails** | fading copies / a line behind fast objects | dashes, projectiles, fast enemies |
| **Sound** | one short SFX per action (see §5) | pair with EVERY visual above |
| **Anticipation pop** | scale 0→1 with `Back.easeOut` | spawning UI cards, pickups, banners |

**Phaser notes (v4):** shake = `this.cameras.main.shake(120, 0.004)` (duration ms,
intensity as fraction of viewport). Hit-stop = briefly set the involved tweens/timers
or a `frozenUntil` guard in `update()` (don't pause the scene — that kills the camera
shake too). Tint flash uses `setTint(c).setTintMode(Phaser.TintModes.FILL)` then
`clearTint()` after a `delayedCall` (v4 removed `setTintFill`). **Pool particles &
floating-text** (object pool, like bullets) — a juicy game still must hold 60fps
(`phaser-perf-audit`). `setVisible(false)` to hide, not `setAlpha(0)`.

**Don't over-juice:** constant max-amplitude shake = nausea + illegibility. Make
shake/hit-stop **scale with impact** (tiny for normal hits, big for crits/bosses),
and consider a "reduced motion" toggle for accessibility. Juice should *clarify* the
action, not bury it.

## 4. Combat readability & enemy telegraphing (fairness = fun)

"Hard but fair" comes from the player **seeing attacks coming**. Unreadable difficulty
feels cheap.

- **Telegraph every threat**: a **wind-up** before an enemy attack — animation
  (rear back / flash), a **color cue** (turn red before a slam), and/or a sound. The
  bigger the hit, the longer/clearer the tell. Players should be able to react even if
  they still get hit.
- **Anatomy of an attack**: *wind-up (telegraph) → strike (active/hitbox) →
  recovery (vulnerable)*. Give the player a window in each phase.
- **Color-code** by meaning consistently (e.g. red = damage incoming, gold = crit,
  green = heal/poison) so the player learns the language.
- **Readable silhouettes & distinct attacks**: each enemy/attack should be
  identifiable at small size and in a crowd. Don't compromise readability to add
  difficulty — escalate via *more/faster/combined* telegraphed attacks instead.
- **Early bosses = loose tutorials** for reading tells; later ones mix the patterns
  to force relearning.

## 5. Sound feedback (instant, layered, mixed)

Sound is half of "feel" and the cheapest big win. The pipeline (load, throttle, mute,
WebAudio cache-guard) is the `phaser-audio` skill — this is the *design* side:

- **One SFX per meaningful action** — fire, hit, crit, pickup, level-up, hurt, death,
  UI click. Silence on action reads as broken.
- **Layer for impact**: a meaty hit = low "thump" + mid "whoosh" + high "crackle".
  Even with single files, pick samples that cover low/mid/high; a crit can play hit +
  a brighter overlay.
- **Vary to avoid fatigue**: tiny **pitch randomization** per play (`±10%`) on
  high-frequency SFX (every shot/hit) stops the ear-grating repeat. Phaser:
  `sound.play(key, { rate: Phaser.Math.FloatBetween(0.9, 1.1) })`.
- **Mix & headroom**: per-SFX volumes, lower spammy ones (shots/hits ~0.15–0.25),
  louder rare ones (level-up ~0.6). Throttle high-frequency keys so a 300-enemy swarm
  doesn't stack into a roar (the `Audio` helper already does per-key throttle).
- **Contextual, not static**: pitch up as combo/speed rises, a different death sound
  for a boss. Tie a property to a live variable when it's cheap.
- **Always CC0** (Kenney/freesound/OpenGameArt), credited in `public/audio/CREDITS.txt`.

## 6. Onboarding / first-time experience

- **First 30 seconds decide retention.** Get to the fun fast — minimal menus, sensible
  defaults, auto-start where possible.
- **Teach by doing, woven in** — not a wall of text. One concept at a time, introduced
  exactly when first needed (the first enemy teaches shooting; the first level-up
  teaches builds).
- **Readable HUD**: show only what matters (floor/round, HP, the build). Don't overlap
  text (a real bug we hit — verify HUD layout with `phaser-smoketest`).
- **Juicy menus too**: pulse the START button, pop cards in with `Back.easeOut`,
  click SFX — the menu is the first "feel" impression.

## 7. Scripting / narrative (light-touch for arcade games)

Most games here are arcade/roguelite — narrative is light, but a little framing helps:

- **Environmental & implied story** over cutscenes: a dungeon backdrop, a boss with a
  crown, "a pet joined!" banners — theme communicates without text.
- **Roguelite framing loop**: *enter → fight → loot/level → get stronger → push
  deeper*; surface it through banners, floor numbers, and the build grid, not prose.
- Keep copy **short and active** ("DEFEATED · TAP TO RETRY"), themed, no walls of text.

---

## Applying this to a game (checklist)

When a game feels flat, audit in this order — cheapest wins first:
1. **Loop**: can you name it in one sentence? Is there a meaningful choice every ~30s?
2. **Juice per action**: does every hit/kill/pickup answer with tint flash + particle
   + sound + a little scale? Add the §3 table items.
3. **Readability**: are enemy threats telegraphed? Is the HUD clean and the build
   visible?
4. **Animation**: easing on every move, squash on key actions, idle bob/blink for life.
5. **Sound**: an SFX per action, pitch-varied, mixed, throttled.
6. **Onboarding**: fast start, teach-by-doing, juicy menu.
Then `phaser-perf-audit` (juice must stay 60fps — pool everything) and
`phaser-smoketest` (verify it renders + no overlap + no console errors).

See also: `pixel-art` (§0 research-first, art craft), `phaser-audio` (sound
pipeline), `phaser-perf-audit` (§3 juice without GC, §6a touch input), `phaser-new-game`,
and `sources.md`.
