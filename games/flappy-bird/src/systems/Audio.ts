import Phaser from 'phaser';
import { AudioKeys, type AudioKey, RegistryKeys } from '../types/keys';

// Thin SFX helper (see the phaser-audio skill). Per-key volume; guards the cache
// (WebAudio decodes async after the first gesture); mute persists in the registry.
const SFX: Record<AudioKey, { volume: number }> = {
  [AudioKeys.Flap]: { volume: 0.35 },
  [AudioKeys.Score]: { volume: 0.5 },
  [AudioKeys.Hit]: { volume: 0.6 },
};

export class Audio {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const muted = (scene.registry.get(RegistryKeys.Muted) as boolean) ?? false;
    scene.sound.setMute(muted);
  }

  play(key: AudioKey): void {
    if (this.scene.sound.mute) return;
    // Skip until decoded — sound.play throws "not found in cache" otherwise.
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
