import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';

// What an in-flight arrow carries from the AttackProfile at fire time. The scene
// resolves collisions against enemies and reads these to apply effects.
export interface ShotData {
  damage: number;
  pierce: number; // remaining enemies it can pass through
  bounce: number; // remaining ricochets
  critChance: number;
  critMul: number;
  burn: number;
  poison: number;
  executeBelow: number;
  lifesteal: number;
  bonusVsFull: number;
  fromHero: boolean;
}

// Pooled projectile. Flies in a straight line; the scene calls tryHit() against
// enemies each frame. On a kill-or-pierce-exhaust it either ricochets (if bounce
// left) or despawns. `hitSet` prevents hitting the same enemy twice.
export class Projectile extends Phaser.GameObjects.Image {
  vx = 0;
  vy = 0;
  radius = 10;
  data2!: ShotData;
  hitSet = new Set<object>();
  private life = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKeys.Arrow);
    this.setActive(false).setVisible(false);
  }

  fire(x: number, y: number, angle: number, speed: number, data: ShotData, tint: number): void {
    this.setPosition(x, y);
    this.setRotation(angle);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.data2 = data;
    this.hitSet = new Set();
    this.life = 0;
    this.setTint(tint);
    this.setScale(0.7).setDepth(18);
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
    this.clearTint();
  }

  /** Integrate; returns true if it left the field and should despawn. */
  step(dt: number, minX: number, maxX: number, minY: number, maxY: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life += dt;
    return this.life > 4 || this.x < minX || this.x > maxX || this.y < minY || this.y > maxY;
  }

  /** Redirect toward a point (used for ricochet). */
  redirect(tx: number, ty: number, speed: number): void {
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.setRotation(a);
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
  }
}
