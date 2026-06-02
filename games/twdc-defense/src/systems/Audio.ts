import Phaser from 'phaser';
import { AudioKeys, type AudioKey, type MusicKey, RegistryKeys } from '../types/keys';

// Throttled SFX helper with a WebAudio cache guard + persisted mute (phaser-audio
// skill). playPitched adds ±10% rate so spammed shots don't fatigue.
const SFX: Record<AudioKey, { volume: number; throttle: number }> = {
  [AudioKeys.Shoot]: { volume: 0.13, throttle: 45 },
  [AudioKeys.Hit]: { volume: 0.15, throttle: 40 },
  [AudioKeys.Explode]: { volume: 0.38, throttle: 80 },
  [AudioKeys.Place]: { volume: 0.4, throttle: 0 },
  [AudioKeys.Lose]: { volume: 0.6, throttle: 200 },
  [AudioKeys.Click]: { volume: 0.5, throttle: 0 },
  // zombie sfx: growls are ambient (longer throttle so a wave doesn't roar), die
  // sounds fire per kill, boss roar is a one-off on spawn.
  [AudioKeys.ZombieGrrr]: { volume: 0.3, throttle: 900 },
  [AudioKeys.ZombieGrrr1]: { volume: 0.3, throttle: 900 },
  [AudioKeys.ZombieBossSfx]: { volume: 0.6, throttle: 0 },
  [AudioKeys.ZombieDie]: { volume: 0.35, throttle: 60 },
  [AudioKeys.ZombieDie2]: { volume: 0.35, throttle: 60 },
};

const MUSIC_VOL = 0.35;

export class Audio {
  private scene: Phaser.Scene;
  private lastPlayed: Partial<Record<AudioKey, number>> = {};
  private music?: Phaser.Sound.BaseSound; // current looping track
  private musicKey?: MusicKey;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const muted = (scene.registry.get(RegistryKeys.Muted) as boolean) ?? false;
    scene.sound.setMute(muted);
    this.installIosUnlock();
    // stop music when the scene shuts down so it doesn't leak across restarts
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopMusic());
  }

  // ── music (looping track; only one plays at a time) ──────────────────────────
  /** Start (or switch to) a looping music track. No-op if it's already playing. */
  playMusic(key: MusicKey): void {
    if (this.musicKey === key && this.music?.isPlaying) return;
    if (!this.scene.cache.audio.exists(key)) return;
    this.stopMusic();
    this.musicKey = key;
    this.music = this.scene.sound.add(key, { loop: true, volume: MUSIC_VOL });
    this.music.play();
  }

  stopMusic(): void {
    this.music?.stop();
    this.music?.destroy();
    this.music = undefined;
    this.musicKey = undefined;
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
