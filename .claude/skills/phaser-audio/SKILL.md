---
name: phaser-audio
description: Add sound to a Phaser game in this monorepo — research a CC0 SFX/music pack first, load it, and wire a small throttled Audio helper (per-key volume, mute toggle persisted in the registry, WebAudio autoplay-unlock handling). Use when the user wants "sound", "âm thanh", "tiếng", "nhạc nền", "SFX", "thêm tiếng", "music", or a game "thiếu âm thanh / không có tiếng".
---

# Phaser Audio (this monorepo)

Add game sound the right way: **research a verified free asset first**, load it, and
play it through a tiny throttled helper. This project is on **Phaser 4.1.0**.

> ## ⚠️ iOS is silent on Ogg-only — ship `.m4a` too (the #1 mobile audio bug)
> **iOS Safari (iPhone/iPad) cannot decode Ogg Vorbis.** A game that ships SFX as
> `.ogg` only is **completely silent on every Apple device** — and you will NOT
> notice on desktop/Android, which play Ogg fine. This silently bit the whole repo.
> Two hard rules below, both **mandatory** for any game with sound:
> 1. **Dual-format**: ship an **`.m4a` (AAC)** sibling for every `.ogg`, and load
>    BOTH with m4a first: `this.load.audio(key, ['audio/x.m4a', 'audio/x.ogg'])`.
>    Phaser picks the first the browser supports (iOS → m4a, others → ogg).
> 2. **Resume on gesture AND on tab return**: iOS 17.5+ **re-suspends** the WebAudio
>    context after a tab/app switch, so resume `sound.context` on first pointer-down
>    **and** on `visibilitychange` (see "WebAudio unlock" below).

## Before adding ANY sound — research first (CC0)
Mirror the art rule: don't grab random audio.
1. **Search a CC0 pack**: **Kenney Audio** (kenney.nl/assets — Impact Sounds, Interface
   Sounds, etc., all CC0 `.ogg`), **freesound.org** (filter CC0), **OpenGameArt** (CC0).
2. **Verify the LICENSE** — only CC0 / clearly-permissive / your own. Add a
   `public/audio/CREDITS.txt` even when CC0 doesn't require it.
3. **Pick a SMALL set** (5–8 clips, ~50KB total) — don't ship a 200-file pack. Rename to
   clear names (`shoot`, `hit`, `pickup`, `levelup`, `hurt`, `click`).

## 0. Plan the audio — 5 systems, not just "background music"

For a pixel/indie game audio carries the **combat feel, weight, immersion, and gameplay
feedback** the simple graphics can't. When scaffolding (pairs with `phaser-new-game` §0d
audio report), plan these **five systems** and list each clip with a note (when it plays):

1. **BGM (music)** — looping tracks per context: menu · gameplay/stage · boss · town ·
   dungeon · victory. **Style** should match the era/theme: 8-bit chiptune (NES) ·
   16-bit SNES-RPG (stronger melody, emotional) · fantasy orchestral (dungeon/boss/
   adventure) · ambient (cave/horror) · cyberpunk synthwave · lo-fi/cozy (farming/casual).
2. **SFX (the gameplay-critical layer)** — group them:
   - **Character:** footstep · jump · land · dash · roll · climb.
   - **Combat:** sword hit · punch · arrow shoot · magic cast · explosion · critical hit.
   - **Environment:** water splash · wind · fire · lava bubble · rain.
   - **UI:** button click · inventory open · quest complete · notification.
   - **Enemy:** roar · attack · hurt · death.
3. **Ambient** — a low, looping environment bed under the music (cave drips · forest
   birds · wind · thunder · machine hum · city crowd) for atmosphere. (See twdc-defense's
   storm bed = a 2nd low loop under the track.)
4. **Voice / vocal** — not full VO; short grunts work great: attack shout, hurt "ugh!",
   NPC gibberish, boss scream. Cheap, big immersion payoff.
5. **Dynamic music** — music reacts to state: enemy spotted → combat track; boss HP low →
   phase-2 track; enter cave → ambience swap. Crossfade, don't hard-cut.

**Minimum for a side-scroller:** BGM (menu / gameplay / boss) + SFX (jump / attack / hit /
enemy-die / UI click) + one ambient bed (wind / cave / rain). **Format:** WAV/short clips
→ SFX, OGG (+ M4A, see below) → BGM; avoid MP3 for realtime. **Mixing matters:** set
per-clip volume, keep headroom, layer low/mid/high for impact, throttle spam (see helper),
±10% pitch (`rate`) so repeats don't fatigue. Free-first (Kenney/freesound/OpenGameArt);
the `phaser-new-game` §0d audio prompts double as search terms, or generate via an SFX/
music AI only for what you can't find.

### ⚠️ SHIP TWO FORMATS — `.ogg` + `.m4a` (NON-NEGOTIABLE for iOS)
**iOS Safari (iPhone/iPad) CANNOT decode Ogg Vorbis.** An `.ogg`-only game is **silent on
every Apple device** — and you won't catch it on desktop/Android (they play Ogg fine). This
is a real bug we shipped repo-wide. So every clip MUST also have an **`.m4a` (AAC)** sibling:
```
public/audio/shoot.ogg   public/audio/shoot.m4a
```
Transcode the whole `public/audio/` tree with the repo script (uses bundled `ffmpeg-static`,
no system ffmpeg needed):
```
node scripts/ogg-to-m4a.mjs      # every *.ogg -> *.m4a (idempotent)
```

Acquisition example (CC0 Kenney): download the pack zip, extract the few clips you want
into `games/<name>/public/audio/`, then run `ogg-to-m4a.mjs`. Verify with Playwright they
decode (see below).

## Loading (PreloadScene)
Load BOTH formats as an array — Phaser plays the first the browser supports. Put **`.m4a`
first** so iOS definitely gets a decodable file:
```ts
for (const key of Object.values(AudioKeys)) {
  // m4a first so iOS Safari (no Ogg support) gets a decodable format.
  this.load.audio(key, [`audio/${key}.m4a`, `audio/${key}.ogg`]);
}
```
Add an **`AudioKeys`** constant block in `types/keys.ts` (never raw string literals) and
a `RegistryKeys.Muted` for the persisted mute flag.

## The Audio helper (throttled, mute-persistent)
Drop a small `systems/Audio.ts` (see `games/survivor/src/systems/Audio.ts` for the
working reference). Non-negotiables it encodes:

- **Throttle per key.** In a bullet-heaven, `shoot`/`hit` fire dozens of times a second
  — playing each would clip and tank perf. Each key has a min-interval (ms); skip plays
  inside it. (Survivor: shoot 70ms, hit 45ms, hurt 200ms; one-shots like levelup/click 0.)
- **Per-key volume.** SFX are loud raw — set sensible volumes (0.15–0.7), not 1.0.
- **Guard the cache.** WebAudio **decodes asynchronously after the first user gesture**;
  until a clip is decoded, `sound.play(key)` throws `"<key> not found in cache"`. So:
  ```ts
  if (!this.scene.cache.audio.exists(key)) return; // not decoded yet — skip silently
  ```
  This is the #1 audio crash. Never call `sound.play` for a key that may not be decoded.
- **Mute toggle persisted** in the game registry (survives scene restarts):
  `scene.sound.setMute(next); scene.registry.set(RegistryKeys.Muted, next);` and re-apply
  it in the helper's constructor on scene (re)entry.

## WebAudio autoplay unlock + iOS re-suspend
- Phaser auto-unlocks the audio context on the **first pointer/key gesture**; check
  `this.sound.locked`. Don't fight it — just **don't play before a gesture**.
- The Menu's "tap/space to start" IS that first gesture — playing a `click` there both
  gives feedback and unlocks audio for the run.
- A Chrome console *warning* about resuming AudioContext after a gesture is expected (not
  an error). The smoke-test should not fail on it.
- **iOS belt-and-suspenders (required).** Even after Phaser unlocks, iOS can leave the
  WebAudio context `suspended`, and **iOS 17.5+ re-suspends it after a tab/app switch**.
  Resume it explicitly on first input AND on `visibilitychange`. Put this in
  `systems/Audio.ts` (call from its constructor):
  ```ts
  private installIosUnlock(scene: Phaser.Scene): void {
    const sm = scene.sound as unknown as { context?: AudioContext };
    const resume = () => { if (sm.context && sm.context.state === 'suspended') void sm.context.resume(); };
    scene.input.once('pointerdown', resume);
    scene.input.keyboard?.once('keydown', resume);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
  }
  ```

### iOS resume helper (the context re-suspends — fixes "no sound on iPhone")
iOS keeps the WebAudio context **suspended** until a gesture AND **re-suspends it after a
tab/app switch or screen lock** (iOS 17.5+) — so sound dies after the player leaves and
returns. Belt-and-suspenders: in the `Audio` helper constructor, resume the context on the
first pointer-down and on every visibility regain. Clean up on scene shutdown.
```ts
private installIosUnlock(): void {
  const sm = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
  const ctx = sm.context as AudioContext | undefined;
  if (!ctx) return; // HTML5 Audio fallback — nothing to resume
  const resume = () => { if (ctx.state === 'suspended') void ctx.resume(); };
  this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, resume);
  const onVis = () => { if (!document.hidden) resume(); };
  document.addEventListener('visibilitychange', onVis);
  this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    document.removeEventListener('visibilitychange', onVis));
}
```

> ## ⚠️ Sound STACKS / blasts loud on tab return — the `pauseOnBlur` bug (2nd worst audio bug)
> Switch to another tab during play, wait, come back → a **burst of stacked SFX fires at
> once, very loud**, and music can double up. Hit this in twdc-defense; the iOS-resume code
> above does NOT fix it (different root cause). Two things conspire:
> 1. **Phaser's `pauseOnBlur` defaults to `true`** — on blur it *pauses* every playing
>    sound, on focus it *resumes* them. Those paused SFX resume + stack on return, fighting
>    any manual handler. **Disable it and manage tab state yourself:**
>    `scene.sound.pauseOnBlur = false;` (set in the Audio helper constructor).
> 2. **The game loop keeps ticking a few frames while backgrounded** and enqueues
>    `sound.play()` against a context the browser is suspending; those buffers all fire the
>    instant you return. So: set a `pageHidden` flag **FIRST**, then `sound.stopAll()` +
>    `ctx.suspend()`. `playInternal`/`playMusic` must early-return while `pageHidden` so the
>    loop can't enqueue anything.
>
> The robust handler (supersedes the iOS-only snippet above — it also covers iOS):
> ```ts
> scene.sound.pauseOnBlur = false;        // stop Phaser's auto pause/resume (the stacking source)
> let pageHidden = false;
> const onHide = () => { if (pageHidden) return; pageHidden = true;
>   scene.sound.stopAll(); if (ctx.state === 'running') void ctx.suspend(); };
> const onShow = () => { if (!pageHidden) return; pageHidden = false;
>   if (ctx.state === 'suspended') void ctx.resume();
>   lastPlayed = {};                       // clear stale throttle timestamps (clock jumped)
>   setTimeout(() => {                      // small delay + re-check, so quick away→back doesn't double-fire
>     if (pageHidden || document.hidden) return;
>     scene.sound.stopAll();               // belt-and-braces: kill anything that slipped through
>     if (musicKey) restartMusic();        // music was killed by stopAll — restart it
>   }, 120);
> };
> // Listen to the FULL set — visibilitychange (tab) + blur/focus + pagehide (window/app switch):
> document.addEventListener('visibilitychange', () => document.hidden ? onHide() : onShow());
> window.addEventListener('blur', onHide); window.addEventListener('focus', onShow);
> window.addEventListener('pagehide', onHide);
> ```
> And in the play path: `if (this.pageHidden) return;` at the top of `playInternal` **and**
> `playMusic`. Also, when the scene clock jumps after a long background, **don't fire
> overdue ambient/loop SFX** — reschedule them (e.g. skip a growl whose timer is >2s overdue).

## Background music (if used)
`const m = this.sound.add(AudioKeys.Music, { loop: true, volume: 0.4 }); m.play();` — add
ONE persistent instance (not `sound.play`, which is fire-and-forget). Stop it on scene
shutdown. Keep music quieter than SFX. Loop a short seamless `.ogg`.

## Mute UI
A `[SOUND]` / `[MUTED]` text toggle (no emoji — house rule) wired to the helper's
`toggleMute()`. Place it in the HUD.

## Verify (Playwright MCP)
After a gesture (click/tap into the game): assert every key is in the cache
(`game.cache.audio.exists(key)` — or `[...game.cache.audio.entries.keys()]`), `sound.locked`
is false, sounds actually fire during play (`game.sound.sounds.filter(s=>s.isPlaying).length`
> 0 over a window), concurrent count stays low (throttle working), mute toggles +
persists (`registry.get('muted')`), and **0 console errors** (esp. no "not found in
cache"). FPS unchanged by audio.
- **iOS dual-format check**: confirm both files exist on disk (`public/audio/<key>.m4a`
  AND `.ogg`) and that `load.audio` lists m4a first. After a gesture, the context state
  should read `running` (not `suspended`). You can't run real Safari in MCP, but the
  m4a-present + m4a-first + context-resumes checks are what prevent the silent-iPhone bug.

## Anti-patterns to refuse
- **Shipping `.ogg` only** — silent on every iPhone/iPad. Always add the `.m4a` sibling
  and load `[m4a, ogg]`. This is the single most common audio bug in this repo.
- `sound.play(key)` without a cache guard (crashes before decode).
- **Leaving `pauseOnBlur` on** + relying only on the iOS snippet — sounds STACK and blast
  loud on tab return. Disable `pauseOnBlur`, gate the play path on a `pageHidden` flag, and
  listen to blur/focus/pagehide (not just visibilitychange). See the boxed bug above.
- Playing a high-frequency SFX every event with no throttle (clip + perf).
- Shipping a whole 100+ file pack (bloat) — pick a handful.
- Audio of unknown license. Emoji mute icons.
- Expecting sound before the first user gesture.

Sources: Phaser 4 audio docs (docs.phaser.io/phaser/concepts/audio), Kenney CC0 audio
(kenney.nl/assets/category:Audio), freesound.org (CC0 filter), OpenGameArt CC0.
