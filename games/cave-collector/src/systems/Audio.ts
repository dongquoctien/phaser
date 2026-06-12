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
  [A.SlimeHit]: { volume: 0.5, throttle: 60 },
  [A.LevelClear]: { volume: 0.6, throttle: 0 },
  [A.GameOver]: { volume: 0.6, throttle: 0 },
  [A.Select]: { volume: 0.5, throttle: 0 },
};

const BGM_VOLUME = 0.35;

export class AudioSystem {
  private scene: Phaser.Scene;
  private lastPlayed: Partial<Record<AudioKey, number>> = {};
  private music?: Phaser.Sound.BaseSound;
  private musicKey?: AudioKey;
  private pageHidden = false;
  private teardown: Array<() => void> = [];
  // Own source of truth for mute — Phaser's `sound.mute` getter can read stale
  // right after setMute() in the same tick, which desynced the mute icon.
  private isMuted = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isMuted = (scene.registry.get(Reg.Muted) as boolean) ?? false;
    scene.sound.setMute(this.isMuted);
    this.installTabHandlers();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopMusic();
      for (const off of this.teardown) off();
      this.teardown = [];
    });
  }

  // Robust tab/blur handling (phaser-audio "pauseOnBlur stacking" bug box):
  //  - disable Phaser's pauseOnBlur (its auto pause→resume is what stacks SFX),
  //  - on hide: set pageHidden FIRST (so the loop can't enqueue), stopAll + suspend,
  //  - on show: resume the context, clear stale throttle stamps (clock jumped), then
  //    after a short delay re-check + restart the music (stopAll killed it).
  // This also covers the iOS suspend/re-suspend case.
  private installTabHandlers(): void {
    const sm = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = sm.context as AudioContext | undefined;
    sm.pauseOnBlur = false; // stop Phaser's auto pause/resume — the stacking source

    const onHide = () => {
      if (this.pageHidden) return;
      this.pageHidden = true;
      this.scene.sound.stopAll();
      if (ctx && ctx.state === 'running') void ctx.suspend();
    };
    const onShow = () => {
      if (!this.pageHidden) return;
      this.pageHidden = false;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      this.lastPlayed = {}; // throttle timestamps are stale after a long background
      setTimeout(() => {
        if (this.pageHidden || document.hidden) return;
        this.scene.sound.stopAll();          // kill anything that slipped through
        if (this.musicKey) this.restartMusic(); // stopAll killed the loop — restart it
      }, 120);
    };

    const onVis = () => (document.hidden ? onHide() : onShow());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onHide);
    window.addEventListener('focus', onShow);
    window.addEventListener('pagehide', onHide);
    this.teardown.push(
      () => document.removeEventListener('visibilitychange', onVis),
      () => window.removeEventListener('blur', onHide),
      () => window.removeEventListener('focus', onShow),
      () => window.removeEventListener('pagehide', onHide),
    );
  }

  play(key: AudioKey): void { this.playInternal(key, 1); }

  /** ±10% pitch jitter so spammed SFX don't fatigue. */
  playPitched(key: AudioKey): void {
    this.playInternal(key, Phaser.Math.FloatBetween(0.9, 1.1));
  }

  private playInternal(key: AudioKey, rate: number): void {
    if (this.pageHidden) return; // don't enqueue while backgrounded (anti-stacking)
    if (this.isMuted) return;
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
    if (this.pageHidden) { this.musicKey = key; return; } // remember; (re)start on return
    if (this.music && this.musicKey === key && this.music.isPlaying) return;
    this.stopMusic();
    this.musicKey = key;
    if (!this.scene.cache.audio.exists(key)) return;
    this.music = this.scene.sound.add(key, { loop: true, volume: BGM_VOLUME });
    this.music.play();
  }

  /** Re-create the current BGM after a stopAll (used on tab return). */
  private restartMusic(): void {
    if (!this.musicKey || !this.scene.cache.audio.exists(this.musicKey)) return;
    // stopAll() only stops; destroy the dead instance so it doesn't pile up.
    if (this.music) { this.music.destroy(); this.music = undefined; }
    this.music = this.scene.sound.add(this.musicKey, { loop: true, volume: BGM_VOLUME });
    this.music.play();
  }

  stopMusic(): void {
    if (this.music) { this.music.stop(); this.music.destroy(); this.music = undefined; }
    this.musicKey = undefined; // intentional stop — don't auto-restart on tab return
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.scene.sound.setMute(this.isMuted);
    this.scene.registry.set(Reg.Muted, this.isMuted);
    localStorage.setItem(Reg.Muted, this.isMuted ? '1' : '0');
    return this.isMuted;
  }

  get muted(): boolean { return this.isMuted; }
}
