import Phaser from 'phaser';
import { AudioKeys, type AudioKey, RegistryKeys } from '../types/keys';

// Thin SFX helper (see the phaser-audio skill). Per-key volume; guards the cache
// (WebAudio decodes async after the first gesture); mute persists in the registry.
const SFX: Record<AudioKey, { volume: number }> = {
  [AudioKeys.Drop]: { volume: 0.4 },
  [AudioKeys.Grab]: { volume: 0.5 },
  [AudioKeys.Score]: { volume: 0.45 },
  [AudioKeys.Win]: { volume: 0.7 },
};

export class Audio {
  private scene: Phaser.Scene;

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
    if (this.scene.sound.mute) return;
    if (!this.scene.cache.audio.exists(key)) return;
    this.scene.sound.play(key, { volume: SFX[key].volume });
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
