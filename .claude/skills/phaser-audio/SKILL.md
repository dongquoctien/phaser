---
name: phaser-audio
description: Add sound to a Phaser game in this monorepo — research a CC0 SFX/music pack first, load it, and wire a small throttled Audio helper (per-key volume, mute toggle persisted in the registry, WebAudio autoplay-unlock handling). Use when the user wants "sound", "âm thanh", "tiếng", "nhạc nền", "SFX", "thêm tiếng", "music", or a game "thiếu âm thanh / không có tiếng".
---

# Phaser Audio (this monorepo)

Add game sound the right way: **research a verified free asset first**, load it, and
play it through a tiny throttled helper. This project is on **Phaser 4.1.0**.

## Before adding ANY sound — research first (CC0)
Mirror the art rule: don't grab random audio.
1. **Search a CC0 pack**: **Kenney Audio** (kenney.nl/assets — Impact Sounds, Interface
   Sounds, etc., all CC0 `.ogg`), **freesound.org** (filter CC0), **OpenGameArt** (CC0).
2. **Verify the LICENSE** — only CC0 / clearly-permissive / your own. Add a
   `public/audio/CREDITS.txt` even when CC0 doesn't require it.
3. **Pick a SMALL set** (5–8 clips, ~50KB total) — don't ship a 200-file pack. Rename to
   clear names (`shoot.ogg`, `hit.ogg`, `pickup.ogg`, `levelup.ogg`, `hurt.ogg`,
   `click.ogg`). Prefer **`.ogg`** (small, well-supported); add `.mp3` only if you need
   Safari/iOS belt-and-suspenders: `this.load.audio(key, ['x.ogg','x.mp3'])`.

Acquisition example (CC0 Kenney): download the pack zip, extract the few clips you want
into `games/<name>/public/assets/audio/` (served as-is by Vite). Verify with Playwright
they decode (see below).

## Loading (PreloadScene)
```ts
for (const key of Object.values(AudioKeys)) {
  this.load.audio(key, `audio/${key}.ogg`);   // public/audio/<key>.ogg
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

## WebAudio autoplay unlock (browsers block audio until a gesture)
- Phaser auto-unlocks the audio context on the **first pointer/key gesture**; check
  `this.sound.locked`. Don't fight it — just **don't play before a gesture**.
- The Menu's "tap/space to start" IS that first gesture — playing a `click` there both
  gives feedback and unlocks audio for the run.
- A Chrome console *warning* about resuming AudioContext after a gesture is expected (not
  an error). The smoke-test should not fail on it.

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

## Anti-patterns to refuse
- `sound.play(key)` without a cache guard (crashes before decode).
- Playing a high-frequency SFX every event with no throttle (clip + perf).
- Shipping a whole 100+ file pack (bloat) — pick a handful.
- Audio of unknown license. Emoji mute icons.
- Expecting sound before the first user gesture.

Sources: Phaser 4 audio docs (docs.phaser.io/phaser/concepts/audio), Kenney CC0 audio
(kenney.nl/assets/category:Audio), freesound.org (CC0 filter), OpenGameArt CC0.
