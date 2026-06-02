import Phaser from 'phaser';
import { AudioKeys, type AudioKey, RegistryKeys } from '../types/keys';

// Throttled SFX helper with a WebAudio cache guard + persisted mute (phaser-audio
// skill). playPitched adds ±10% rate so spammed shots don't fatigue.
const SFX: Record<AudioKey, { volume: number; throttle: number }> = {
  [AudioKeys.Shoot]: { volume: 0.13, throttle: 45 },
  [AudioKeys.Hit]: { volume: 0.15, throttle: 40 },
  [AudioKeys.Explode]: { volume: 0.38, throttle: 80 },
  [AudioKeys.Place]: { volume: 0.4, throttle: 0 },
  [AudioKeys.Lose]: { volume: 0.6, throttle: 200 },
  [AudioKeys.Click]: { volume: 0.5, throttle: 0 },
};

export class Audio {
  private scene: Phaser.Scene;
  private lastPlayed: Partial<Record<AudioKey, number>> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const muted = (scene.registry.get(RegistryKeys.Muted) as boolean) ?? false;
    scene.sound.setMute(muted);
    // iOS belt-and-suspenders: even after Phaser unlocks, the WebAudio context can
    // stay 'suspended' until explicitly resumed inside a gesture. Resume it on the
    // first pointer/touch so SFX actually play on iPhone/iPad.
    const sm = scene.sound as unknown as { context?: AudioContext };
    const resume = () => { if (sm.context && sm.context.state === 'suspended') void sm.context.resume(); };
    scene.input.once('pointerdown', resume);
    scene.input.keyboard?.once('keydown', resume);
  }

  play(key: AudioKey): void {
    this.playInternal(key, 1);
  }
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
