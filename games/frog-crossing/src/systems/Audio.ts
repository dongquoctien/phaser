import Phaser from 'phaser';
import { AudioKeys, type AudioKey, RegistryKeys } from '../types/keys';

// Thin SFX helper. play() is throttled per-key, mute persists in the registry,
// and a cache guard skips play() before WebAudio has decoded the clip (the clip
// isn't in cache until after the first user gesture → sound.play would throw
// "not found in cache"). Same pattern as the other games (phaser-audio skill).
const SFX: Record<AudioKey, { volume: number; throttle: number }> = {
  [AudioKeys.Hop]: { volume: 0.3, throttle: 40 },
  [AudioKeys.Splash]: { volume: 0.5, throttle: 120 },
  [AudioKeys.Crash]: { volume: 0.55, throttle: 120 },
  [AudioKeys.Score]: { volume: 0.4, throttle: 60 },
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
    if (this.scene.sound.mute) return;
    if (!this.scene.cache.audio.exists(key)) return;
    const cfg = SFX[key];
    const now = this.scene.time.now;
    if (cfg.throttle > 0 && now - (this.lastPlayed[key] ?? -1e9) < cfg.throttle) return;
    this.lastPlayed[key] = now;
    this.scene.sound.play(key, { volume: cfg.volume });
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
