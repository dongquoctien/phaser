import Phaser from 'phaser';
import { Audio as A, type AudioKey, Reg } from '../types/keys';

// SFX config: per-key volume + throttle (ms). Throttle stops rapid-fire clips
// (footsteps, hits) from machine-gunning. BGM tracks are handled separately.
const SFX: Partial<Record<AudioKey, { volume: number; throttle: number }>> = {
  [A.Footstep]: { volume: 0.25, throttle: 230 },
  [A.Jump]: { volume: 0.4, throttle: 80 },
  [A.Land]: { volume: 0.35, throttle: 120 },
  [A.Punch]: { volume: 0.45, throttle: 60 },
  [A.BlockPay]: { volume: 0.5, throttle: 0 },
  [A.Star]: { volume: 0.5, throttle: 0 },
  [A.Coin]: { volume: 0.4, throttle: 40 },
  [A.Hurt]: { volume: 0.5, throttle: 200 },
  [A.BotHit]: { volume: 0.5, throttle: 60 },
  [A.LevelClear]: { volume: 0.6, throttle: 0 },
  [A.GameOver]: { volume: 0.6, throttle: 0 },
  [A.Select]: { volume: 0.5, throttle: 0 },
};

const BGM_VOLUME = 0.35;

export class AudioSystem {
  private scene: Phaser.Scene;
  private lastPlayed: Partial<Record<AudioKey, number>> = {};
  private music?: Phaser.Sound.BaseSound;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const muted = (scene.registry.get(Reg.Muted) as boolean) ?? false;
    scene.sound.setMute(muted);
    this.installIosUnlock();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopMusic());
  }

  // iOS Safari starts WebAudio "suspended" and only resumes on a gesture; it
  // also re-suspends after a tab switch. Resume on pointer + visibility so the
  // game isn't silent on iPhone/iPad.
  private installIosUnlock(): void {
    const sm = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = sm.context as AudioContext | undefined;
    if (!ctx) return;
    const resume = () => { if (ctx.state === 'suspended') void ctx.resume(); };
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, resume);
    const onVis = () => { if (!document.hidden) resume(); };
    document.addEventListener('visibilitychange', onVis);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVis);
    });
  }

  play(key: AudioKey): void { this.playInternal(key, 1); }

  /** ±10% pitch jitter so spammed SFX don't fatigue. */
  playPitched(key: AudioKey): void {
    this.playInternal(key, Phaser.Math.FloatBetween(0.9, 1.1));
  }

  private playInternal(key: AudioKey, rate: number): void {
    if (this.scene.sound.mute) return;
    if (!this.scene.cache.audio.exists(key)) return;
    const cfg = SFX[key];
    if (!cfg) return;
    const now = this.scene.time.now;
    if (cfg.throttle > 0 && now - (this.lastPlayed[key] ?? -1e9) < cfg.throttle) return;
    this.lastPlayed[key] = now;
    this.scene.sound.play(key, { volume: cfg.volume, rate });
  }

  /** Loop a BGM track, stopping any current one. Safe before the gesture. */
  playMusic(key: AudioKey): void {
    if (this.music && (this.music as Phaser.Sound.BaseSound & { key: string }).key === key) return;
    this.stopMusic();
    if (!this.scene.cache.audio.exists(key)) return;
    this.music = this.scene.sound.add(key, { loop: true, volume: BGM_VOLUME });
    this.music.play();
  }

  stopMusic(): void {
    if (this.music) { this.music.stop(); this.music.destroy(); this.music = undefined; }
  }

  toggleMute(): boolean {
    const next = !this.scene.sound.mute;
    this.scene.sound.setMute(next);
    this.scene.registry.set(Reg.Muted, next);
    localStorage.setItem(Reg.Muted, next ? '1' : '0');
    return next;
  }

  get muted(): boolean { return this.scene.sound.mute; }
}
