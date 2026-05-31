import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';

export type LootKind = 'gold-s' | 'gold-l' | 'rock';

interface LootSpec {
  texture: string;
  value: number;
  weight: number; // 1 = light (fast pull), higher = slower
  radius: number; // grab radius in px
}

export const LOOT_SPECS: Record<LootKind, LootSpec> = {
  // Grab radii are generous so the swinging hook actually connects with the
  // sparse field; tuned by Playwright observation of hook-tip vs loot distance.
  'gold-s': { texture: TextureKeys.GoldS, value: 50, weight: 1, radius: 22 },
  'gold-l': { texture: TextureKeys.GoldL, value: 120, weight: 2.4, radius: 28 },
  rock: { texture: TextureKeys.Rock, value: 15, weight: 3.2, radius: 26 },
};

// A pooled piece of loot sitting in the cavern. The hook grabs it on contact.
export class Loot extends Phaser.GameObjects.Image {
  kind: LootKind = 'gold-s';
  value = 0;
  weight = 1;
  radius = 12;
  grabbed = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKeys.GoldS);
    this.setActive(false).setVisible(false);
  }

  place(kind: LootKind, x: number, y: number): void {
    const spec = LOOT_SPECS[kind];
    this.kind = kind;
    this.value = spec.value;
    this.weight = spec.weight;
    this.radius = spec.radius;
    this.grabbed = false;
    this.setTexture(spec.texture);
    this.setPosition(x, y);
    this.setScale(2);
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.grabbed = false;
    this.setActive(false).setVisible(false);
  }
}
