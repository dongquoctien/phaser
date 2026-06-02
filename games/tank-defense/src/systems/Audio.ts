import Phaser from 'phaser';
import { AudioKeys, type AudioKey, RegistryKeys } from '../types/keys';

// Throttled SFX helper with a WebAudio cache guard + persisted mute (phaser-audio
// skill). playPitched adds ±10% rate so spammed shots don't fatigue.
const SFX: Record<AudioKey, { volume: number; throttle: number }> = {
  [AudioKeys.Shoot]: { volume: 0.14, throttle: 45 },
  [AudioKeys.Hit]: { volume: 0.16, throttle: 40 },
  [AudioKeys.Explode]: { volume: 0.4, throttle: 80 },
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
