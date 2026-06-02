import Phaser from 'phaser';
import { AudioKeys, type AudioKey, RegistryKeys } from '../types/keys';

// Thin SFX helper. play() is throttled per-key so high-frequency events (every
// shot, every hit on a 300-enemy swarm) don't spam hundreds of overlapping
// sounds per second — they'd clip and tank perf. Global mute persists in the
// game registry (survives scene restarts).
//
// Per-sound default volumes + min-interval (ms) between plays of the same key.
const SFX: Record<AudioKey, { volume: number; throttle: number }> = {
  [AudioKeys.Shoot]: { volume: 0.18, throttle: 70 },
  [AudioKeys.Hit]: { volume: 0.22, throttle: 45 },
  [AudioKeys.Hurt]: { volume: 0.5, throttle: 200 },
  [AudioKeys.Pickup]: { volume: 0.25, throttle: 40 },
  [AudioKeys.LevelUp]: { volume: 0.7, throttle: 0 },
  [AudioKeys.Click]: { volume: 0.5, throttle: 0 },
};

export class Audio {
  private scene: Phaser.Scene;
  private lastPlayed: Partial<Record<AudioKey, number>> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Apply persisted mute on (re)entry.
    const muted = (scene.registry.get(RegistryKeys.Muted) as boolean) ?? false;
    scene.sound.setMute(muted);
    this.installIosUnlock();
  }

  // iOS Safari starts the WebAudio context "suspended" and only resumes it from a
  // user gesture; it also re-suspends after a tab/app switch (iOS 17.5+). Resume
  // on the first pointer down and whenever the page regains visibility, so audio
  // isn't silently dead on iPhone/iPad.
  private installIosUnlock(): void {
    const sm = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = sm.context as AudioContext | undefined;
    if (!ctx) return; // HTML5 Audio fallback — nothing to resume
    const resume = () => {
      if (ctx.state === 'suspended') void ctx.resume();
    };
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, resume);
    const onVis = () => {
      if (!document.hidden) resume();
    };
    document.addEventListener('visibilitychange', onVis);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVis);
    });
  }

  /** Play a one-shot SFX (throttled per key; ignored while muted or not yet decoded). */
  play(key: AudioKey): void {
    if (this.scene.sound.mute) return;
    // WebAudio decodes asynchronously after the first user gesture — until the
    // clip is in the cache, sound.play() throws "not found in cache". Skip
    // silently until it's ready instead of crashing the game loop.
    if (!this.scene.cache.audio.exists(key)) return;
    const cfg = SFX[key];
    const now = this.scene.time.now;
    if (cfg.throttle > 0 && now - (this.lastPlayed[key] ?? -1e9) < cfg.throttle) return;
    this.lastPlayed[key] = now;
    this.scene.sound.play(key, { volume: cfg.volume });
  }

  /** Toggle global mute and persist it. Returns the new muted state. */
  toggleMute(): boolean {
    const next = !this.scene.sound.mute;
    this.scene.sound.setMute(next);
    this.scene.registry.set(RegistryKeys.Muted, next);
    return next;
  }

  get muted(): boolean {
    return this.scene.sound.mute;
  }
}
