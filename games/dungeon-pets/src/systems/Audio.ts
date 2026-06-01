import Phaser from 'phaser';
import { AudioKeys, type AudioKey, RegistryKeys } from '../types/keys';

// Thin SFX helper: per-key throttle, mute persisted in the registry, and a cache
// guard that skips play() before WebAudio decodes the clip (the clip isn't in
// cache until the first user gesture → sound.play would throw). Same pattern as
// the other games (phaser-audio skill).
const SFX: Record<AudioKey, { volume: number; throttle: number }> = {
  [AudioKeys.Hit]: { volume: 0.16, throttle: 55 },
  [AudioKeys.Skill]: { volume: 0.3, throttle: 80 },
  [AudioKeys.LevelUp]: { volume: 0.6, throttle: 0 },
  [AudioKeys.Defeat]: { volume: 0.6, throttle: 200 },
  [AudioKeys.Click]: { volume: 0.5, throttle: 0 },
};

export class Audio {
  private scene: Phaser.Scene;
  private lastPlayed: Partial<Record<AudioKey, number>> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const muted = (scene.registry.get(RegistryKeys.Muted) as boolean) ?? false;
    scene.sound.setMute(muted);
  }

  play(key: AudioKey): void {
    this.playInternal(key, 1);
  }

  /** Like play() but with ±10% pitch jitter so spammed SFX don't fatigue (§5). */
  playPitched(key: AudioKey): void {
    this.playInternal(key, Phaser.Math.FloatBetween(0.9, 1.1));
  }

  private playInternal(key: AudioKey, rate: number): void {
    if (this.scene.sound.mute) return;
    if (!this.scene.cache.audio.exists(key)) return;
    const cfg = SFX[key];
    const now = this.scene.time.now;
    if (cfg.throttle > 0 && now - (this.lastPlayed[key] ?? -1e9) < cfg.throttle) return;
    this.lastPlayed[key] = now;
    this.scene.sound.play(key, { volume: cfg.volume, rate });
  }

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
