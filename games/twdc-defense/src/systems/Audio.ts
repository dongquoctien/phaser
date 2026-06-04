import Phaser from 'phaser';
import { AudioKeys, type AudioKey, type MusicKey, RegistryKeys } from '../types/keys';

// Throttled SFX helper with a WebAudio cache guard + persisted mute (phaser-audio
// skill). playPitched adds ±10% rate so spammed shots don't fatigue.
const SFX: Record<AudioKey, { volume: number; throttle: number; group?: string; raw?: boolean }> = {
  [AudioKeys.Shoot]: { volume: 0.13, throttle: 45 },
  [AudioKeys.Hit]: { volume: 0.15, throttle: 40 },
  [AudioKeys.Explode]: { volume: 0.38, throttle: 80 },
  [AudioKeys.Place]: { volume: 0.4, throttle: 0 },
  [AudioKeys.Lose]: { volume: 0.6, throttle: 200 },
  [AudioKeys.Click]: { volume: 0.5, throttle: 0 },
  // zombie sfx: growls are ambient (longer throttle so a wave doesn't roar), die
  // sounds fire per kill, boss roar is a one-off on spawn.
  [AudioKeys.ZombieGrrr]: { volume: 0.15, throttle: 900, group: 'grrr' }, // halved (ambient growl)
  [AudioKeys.ZombieGrrr1]: { volume: 0.15, throttle: 900, group: 'grrr' },
  [AudioKeys.ZombieBossSfx]: { volume: 0.5, throttle: 0 }, // → 0.5×0.7 = 0.35 played
  // die sounds share ONE throttle group so a mass-kill (AoE/nova/cleave) plays a
  // single death sound, not a wall of them. ~350ms feels punchy without spamming.
  [AudioKeys.ZombieDie]: { volume: 0.3, throttle: 350, group: 'die' },
  [AudioKeys.ZombieDie2]: { volume: 0.3, throttle: 350, group: 'die' },
  // boss hero-execution: slow-mo sting on enter, "push" blow on the kill.
  [AudioKeys.BossKillSlow]: { volume: 0.6, throttle: 0 },
  [AudioKeys.Push]: { volume: 0.7, throttle: 0 },
  // game-over plays at TRUE full volume (raw = bypass the global VOL_SCALE).
  [AudioKeys.GameOver]: { volume: 1.0, throttle: 0, raw: true },
  // merge "fusion" ping — a satisfying confirm when two heroes fuse.
  [AudioKeys.Merge]: { volume: 0.6, throttle: 0 },
};

// Global volume scale applied to every SFX + music — drop everything 30% (×0.7).
const VOL_SCALE = 0.7;
const MUSIC_VOL = 0.35 * VOL_SCALE;
// per-track music multiplier (1 = normal). Boss track plays at full music volume.
const MUSIC_TRACK_VOL: Partial<Record<MusicKey, number>> = { 'boss-music': 1.0 };

export class Audio {
  private scene: Phaser.Scene;
  private lastPlayed: Record<string, number> = {}; // keyed by throttle slot (group or key)
  private music?: Phaser.Sound.BaseSound; // current looping track
  private musicKey?: MusicKey;
  private pageHidden = false; // true while the tab is backgrounded — drop all sound

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const muted = (scene.registry.get(RegistryKeys.Muted) as boolean) ?? false;
    scene.sound.setMute(muted);
    // Disable Phaser's own blur-pause/focus-resume — it pauses every sound on blur
    // then resumes them on focus, which fights our handler and lets paused SFX
    // resume + STACK on return. We do tab handling ourselves (suspend + drop).
    scene.sound.pauseOnBlur = false;
    this.installVisibilityHandling();
    // stop music when the scene shuts down so it doesn't leak across restarts
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopMusic());
  }

  /** True while the tab/window is backgrounded — callers can use this to skip
   *  sound-producing work in the game loop entirely (defense in depth). */
  get suspended(): boolean { return this.pageHidden; }

  // ── music (looping track; only one plays at a time) ──────────────────────────
  /** Start (or switch to) a looping music track. No-op if it's already playing. */
  playMusic(key: MusicKey): void {
    if (this.pageHidden) return; // don't start a track while backgrounded
    if (this.musicKey === key && this.music?.isPlaying) return;
    if (!this.scene.cache.audio.exists(key)) return;
    this.stopMusic();
    this.musicKey = key;
    const vol = MUSIC_VOL * (MUSIC_TRACK_VOL[key] ?? 1);
    this.music = this.scene.sound.add(key, { loop: true, volume: vol });
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
  //
  // The flip side — and the real bug this also fixes: when the tab goes to the
  // background, the browser throttles rAF but the game loop can still tick a few
  // frames and enqueue sound.play() calls. Those buffers schedule against a
  // context the browser is suspending, then ALL fire together (rapid + very loud)
  // the instant you return. So we hard-mute + suspend the context on hide, and
  // only unmute/resume on return — nothing gets queued while hidden.
  private installVisibilityHandling(): void {
    const sm = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = sm.context as AudioContext | undefined;
    if (!ctx) return; // HTML5 Audio fallback — nothing to resume

    // On hide/blur: set the flag FIRST (so any in-flight game-loop frame is already
    // gagged), stop everything that's playing, then suspend the context so no
    // queued buffer can sound. iOS also re-suspends on its own here.
    const onHide = () => {
      if (this.pageHidden) return;
      this.pageHidden = true;
      this.scene.sound.stopAll();
      if (ctx.state === 'running') void ctx.suspend();
    };

    // On show/focus: resume the context, clear stale throttle stamps, and restart
    // the looping music — but only AFTER a short tick, and only if we're still
    // visible, so a quick away-and-back doesn't double-trigger or race the resume.
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    const onShow = () => {
      if (!this.pageHidden) return;
      this.pageHidden = false;
      if (ctx.state === 'suspended') void ctx.resume();
      this.lastPlayed = {}; // clear stale throttle timestamps (time jumped while hidden)
      if (showTimer) clearTimeout(showTimer);
      showTimer = setTimeout(() => {
        if (this.pageHidden || document.hidden) return; // hid again before the tick
        this.scene.sound.stopAll(); // belt-and-braces: kill anything that slipped through
        if (this.musicKey) { const k = this.musicKey; this.musicKey = undefined; this.playMusic(k); }
      }, 120);
    };

    // Resume the WebAudio context on the first user gesture (autoplay unlock).
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!this.pageHidden && ctx.state === 'suspended') void ctx.resume();
    });

    // Listen to the full set of background signals — visibilitychange covers tab
    // switches; blur/pagehide catch window/app switches that don't flip visibility.
    const onVis = () => (document.hidden ? onHide() : onShow());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onHide);
    window.addEventListener('focus', onShow);
    window.addEventListener('pagehide', onHide);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (showTimer) clearTimeout(showTimer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onHide);
      window.removeEventListener('focus', onShow);
      window.removeEventListener('pagehide', onHide);
    });
  }

  play(key: AudioKey): void {
    this.playInternal(key, 1);
  }
  playPitched(key: AudioKey): void {
    this.playInternal(key, Phaser.Math.FloatBetween(0.9, 1.1));
  }

  private playInternal(key: AudioKey, rate: number): void {
    if (this.pageHidden) return; // never enqueue sound while backgrounded
    if (this.scene.sound.mute) return;
    if (!this.scene.cache.audio.exists(key)) return;
    const cfg = SFX[key];
    const now = this.scene.time.now;
    // throttle by group when set (so all die sounds share one cooldown), else by key
    const slot = cfg.group ?? key;
    if (cfg.throttle > 0 && now - (this.lastPlayed[slot] ?? -1e9) < cfg.throttle) return;
    this.lastPlayed[slot] = now;
    const volume = cfg.raw ? cfg.volume : cfg.volume * VOL_SCALE; // raw bypasses global scale
    this.scene.sound.play(key, { volume, rate });
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
