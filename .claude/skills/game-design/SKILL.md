---
name: game-design
description: Design the FEEL of a game — core loop & pacing, juice (screen shake, hit-stop, squash/stretch, particles, color flash, damage numbers), animation principles + frame timing, VFX/effect anatomy (additive vs alpha blend, explosion/spell phases), sound feedback, enemy telegraphing/readability, onboarding, reading/reverse-engineering a game from a reference image, and inferring narrative/theme logic from genre. Use when a game "feels flat / boring / không có chiều sâu / nhạt / thiếu cảm giác", when building combat/feedback or effects, when planning a new game's loop & progression, or when deconstructing a reference screenshot into mechanics. The design counterpart to the technical phaser-* skills.
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

### Frame-by-frame timing (if you DO animate frames, not just tween)
The single thing that separates amateur from pro sprite animation is **uneven
timing** — don't hold every frame the same. Hold the **key poses** long, blow through
the transitions:
- **Walk cycle** = 4 poses min (contact → passing → contact → passing), ~80–150ms each,
  fairly even. 6 frames = smoother, 8 = AAA. Add a 1-px/1-frame delay on hair/tail/ears
  (secondary motion) and the walk comes alive.
- **Attack** = wind-up → anticipation peak → **strike** → recovery, but **variable**:
  e.g. wind-up 80ms, hold the anticipation 300–400ms, strike 1 fast frame, recovery
  ~150ms. Equal 100ms-per-frame feels mushy; the long hold on anticipation is what
  telegraphs the hit (ties to §4). This makes 4 frames *feel* like twelve.
- In Phaser this maps to per-frame `duration` in a tween timeline, or a sprite-sheet
  anim with custom `frameRate`/per-frame holds — not a constant rate.

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

### Inferring story/logic from a genre (when there's no script)
When the brief is just "make a game like this image", derive the implied logic:
- **Genre conventions carry meaning** — a crown = boss/elite; a skull = danger/death;
  a heart = HP/heal; gold = currency/reward; a lock = gated progression. Reuse the
  language players already know instead of inventing.
- **The Holy Trinity** (plot · character · lore) collapses to *theme cohesion* for
  arcade games: every visual + system should point at one fantasy ("plucky pets brave
  an endless dungeon"). A capybara hero + skeleton foes + a pet joining = that fantasy,
  no prose needed.
- **Tie every loop back to the player's core goal/motivation** (survive deeper, get
  stronger). If a system doesn't serve the fantasy or the goal, cut it.
- **Consistency = believability**: don't mix tones/themes at random. A tiny "lore
  bible" in your head (what is this world, who's the hero, what's the threat) keeps
  art, copy, and systems aligned.

## 8. Reading a reference image (reverse-engineering a game from a screenshot)

Most new games here start from a reference image. Deconstruct it systematically before
building — this is what turns "make a game like this" into a correct plan:

1. **Genre & core loop** — what is the player *doing*? (auto-battle? hop? aim+fire?)
   Name the loop in one sentence (§1). Telltales: a fire button vs auto-attack, a grid
   vs free movement, lanes, waves, a timer.
2. **HUD inventory** — list every on-screen element and infer its system: big number =
   idle scaling; HP/ATK/DEF bars = stats; "Round 1/15" = wave structure; "Floor 52" =
   endless depth; a skill grid = accumulating build (roguelite); "x3" = speed toggle;
   "Give Up" = run-based with settle-on-quit.
3. **Entities & roles** — hero(es), enemies (and which is elite/boss via crown/size/
   colour), pets/companions, projectiles, drops. Note facing/orientation and relative
   scale.
4. **Art style** — vector-cartoon vs pixel; palette; rounded vs sharp; shading. Decide
   SVG (default) vs pixel-on-request (`pixel-art`). **Research the genre's look** before
   drawing (don't copy the reference's exact assets — they're usually licensed).
5. **Layout & orientation** — portrait/landscape, where the action band sits, where the
   controls/HUD live. Match it (mobile reference → portrait 480×800 here).
6. **What to build first** — extract the *core* (entities + the one loop + win/lose)
   and defer meta (leaderboard, gacha, shops). Confirm scope with the user.
> Pitfall: don't reproduce the reference's exact numbers/art — infer the *system* and
> rebuild it CC0-clean. The image tells you the **mechanics and feel**, not the assets.

## 9. Effect / VFX anatomy (beyond the §3 juice quick-hits)

For bigger effects (explosions, spells, deaths), think in **phases + blend modes**:
- **Anatomy**: *charge/anticipation → burst/impact → dissipate/fade*. Even a 3-tween
  sequence (grow → flash → shrink+fade) reads as a deliberate effect, not a blip.
- **Additive blend** = bright glows, fire cores, sparks, magic (colours add → white-hot
  centres). **Alpha blend** = smoke, soft particles, shockwave rings. In Phaser:
  `setBlendMode(Phaser.BlendModes.ADD)` on the glow sprites; normal alpha for smoke.
- **Layer** several systems for one effect: a bright additive core + alpha smoke + a
  few fast sparks + a quick expanding ring reads far richer than one puff.
- **Colour-code by meaning** (consistent with §4): gold = crit, red = fire/danger,
  green = poison/heal, blue = the hero's own shots. The effect *communicates*, not just
  decorates — a shockwave confirms "the hit landed".
- **Timing**: effects are FAST (impact 100–300ms); a slow effect feels mushy. Scale
  size/intensity by the event's weight (small hit vs boss death). **Pool everything**
  (`phaser-perf-audit`) — a screen of effects must hold 60fps.

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
