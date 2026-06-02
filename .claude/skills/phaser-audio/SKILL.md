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
   clear names (`shoot.ogg`, `hit.ogg`, `pickup.ogg`, `levelup.ogg`, `hurt.ogg`,
   `click.ogg`).
4. **Make the `.m4a` siblings — REQUIRED, not optional** (see the iOS box above).
   Transcode every `.ogg` to `.m4a` (AAC). Use a Node script with **`ffmpeg-static`**
   (bundled binary, no system ffmpeg needed) so it runs anywhere:
   ```js
   // scripts/ogg-to-m4a.mjs — `node scripts/ogg-to-m4a.mjs games/<name>/public/audio`
   import ffmpeg from 'ffmpeg-static'; import { execFileSync } from 'node:child_process';
   import { readdirSync } from 'node:fs'; import { join } from 'node:path';
   const dir = process.argv[2];
   for (const f of readdirSync(dir).filter((n) => n.endsWith('.ogg'))) {
     const out = join(dir, f.replace(/\.ogg$/, '.m4a'));
     execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', join(dir, f),
       '-c:a', 'aac', '-b:a', '96k', out]);
   }
   ```
   (System `ffmpeg` works too, but `ffmpeg-static` is the portable default for this repo.)

Acquisition example (CC0 Kenney): download the pack zip, extract the few clips you want
into `games/<name>/public/audio/` (served as-is by Vite), transcode to `.m4a`, then
verify with Playwright they decode (see below).

## Loading (PreloadScene) — dual format, m4a first
```ts
for (const key of Object.values(AudioKeys)) {
  // m4a FIRST so iOS (which can't decode Ogg) gets a format it supports.
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
- Playing a high-frequency SFX every event with no throttle (clip + perf).
- Shipping a whole 100+ file pack (bloat) — pick a handful.
- Audio of unknown license. Emoji mute icons.
- Expecting sound before the first user gesture.

Sources: Phaser 4 audio docs (docs.phaser.io/phaser/concepts/audio), Kenney CC0 audio
(kenney.nl/assets/category:Audio), freesound.org (CC0 filter), OpenGameArt CC0.
