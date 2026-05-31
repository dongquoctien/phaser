import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';
import { Tuning } from '../tuning';
import type { HashItem } from '../systems/SpatialHash';

// Pooled straight-line projectile. Plain Image, integrated manually.
export class Bullet extends Phaser.GameObjects.Image implements HashItem {
  vx = 0;
  vy = 0;
  damage = 0;
  radius: number = Tuning.bulletRadius;
  private dieAt = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKeys.Bullet);
    this.setActive(false).setVisible(false);
  }

  fire(x: number, y: number, dirX: number, dirY: number, damage: number, now: number): void {
    this.setPosition(x, y);
    this.vx = dirX * Tuning.bulletSpeed;
    this.vy = dirY * Tuning.bulletSpeed;
    this.damage = damage;
    this.setRotation(Math.atan2(dirY, dirX) + Math.PI / 2);
    this.dieAt = now + Tuning.bulletLifetime;
    this.setActive(true).setVisible(true).setDepth(8).setScale(2);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }

  /** Move; returns true when it expired (caller despawns). */
  integrate(dt: number, now: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    return now >= this.dieAt;
  }
}
