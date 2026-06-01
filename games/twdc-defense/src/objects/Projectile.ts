import Phaser from 'phaser';
import type { HeroDef, HeroTier } from '../types/roster';

// A pooled projectile. It homes-lite toward where its target was aimed and the
// scene resolves the hit (damage + the hero's skill effect) when it arrives.
// The hero def + active tier ride along so the resolver knows what to apply.
export class Projectile extends Phaser.GameObjects.Image {
  vx = 0;
  vy = 0;
  damage = 0;
  hero!: HeroDef;
  tier!: HeroTier;
  isCrit = false;
  private life = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'proj-bullet');
    this.setActive(false).setVisible(false);
  }

  fire(tex: string, x: number, y: number, angle: number, speed: number, damage: number, hero: HeroDef, tier: HeroTier, isCrit: boolean): void {
    this.setTexture(tex);
    this.setPosition(x, y).setRotation(angle + Math.PI / 2);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.hero = hero;
    this.tier = tier;
    this.isCrit = isCrit;
    this.life = 0;
    this.setScale(isCrit ? 1.25 : 1).setDepth(12);
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }

  /** Integrate; returns true if it should despawn (off-field / expired). */
  step(dt: number, w: number, h: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life += dt;
    return this.life > 2.5 || this.x < -24 || this.x > w + 24 || this.y < -24 || this.y > h + 24;
  }
}
