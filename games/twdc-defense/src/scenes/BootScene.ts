import Phaser from 'phaser';
import { SceneKeys, RegistryKeys, mapBestKey, mapClearedKey } from '../types/keys';
import { MAP_COUNT } from '../types/map';
import { Storage } from '../systems/Storage';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    // Seed the in-memory registry from localStorage so progress + identity survive
    // a page reload. The game still reads/writes the registry as before; this just
    // restores it on boot and the GameScene mirrors writes back to Storage.
    this.registry.set(RegistryKeys.PlayerId, Storage.getPlayerId());
    this.registry.set(RegistryKeys.Nickname, Storage.getNickname());
    for (let i = 0; i < MAP_COUNT; i++) {
      this.registry.set(mapBestKey(i), Storage.getBest(i));
      if (Storage.isCleared(i)) this.registry.set(mapClearedKey(i), true);
    }
    this.scene.start(SceneKeys.Preload);
  }
}
