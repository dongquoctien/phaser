import Phaser from 'phaser';
import { type EnemyDef } from '../types/roster';

// A pooled enemy tank that follows the waypoint path. Plain Image moved manually
// (no physics body) — towers query it via the scene's enemy list.
export class Enemy extends Phaser.GameObjects.Image {
  hp = 0;
  maxHp = 0;
  speed = 0;
  bounty = 0;
  dead = true;
  reachedEnd = false;
  private wpIndex = 0;
  private waypoints: { x: number; y: number }[] = [];
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpBarBg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'enemy-light');
    this.setActive(false).setVisible(false);
    this.hpBarBg = scene.add.rectangle(0, 0, 28, 4, 0x1a1c2c).setDepth(15).setVisible(false);
    this.hpBar = scene.add.rectangle(0, 0, 26, 2, 0xb13e53).setOrigin(0, 0.5).setDepth(16).setVisible(false);
  }

  spawn(def: EnemyDef, hp: number, baseSpeed: number, bountyBase: number, waypoints: { x: number; y: number }[]): void {
    this.setTexture(def.tex).setScale(def.scale);
    this.hp = hp;
    this.maxHp = hp;
    this.speed = baseSpeed * def.speedMul;
    this.bounty = Math.round(bountyBase * def.bounty);
    this.waypoints = waypoints;
    this.wpIndex = 0;
    this.dead = false;
    this.reachedEnd = false;
    const wp0 = waypoints[0];
    this.setPosition(wp0.x, wp0.y).setActive(true).setVisible(true).setDepth(10);
    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);
  }

  despawn(): void {
    this.dead = true;
    this.setActive(false).setVisible(false);
    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);
    this.clearTint();
  }

  /** Step toward the next waypoint. Returns 'end' if it reached the exit. */
  step(dt: number): 'end' | null {
    if (this.dead) return null;
    const target = this.waypoints[this.wpIndex + 1];
    if (!target) { this.reachedEnd = true; return 'end'; }
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const move = this.speed * dt;
    if (dist <= move) {
      this.setPosition(target.x, target.y);
      this.wpIndex += 1;
    } else {
      this.x += (dx / dist) * move;
      this.y += (dy / dist) * move;
      this.setRotation(Math.atan2(dy, dx) + Math.PI / 2); // tank faces travel dir
    }
    this.updateHpBar();
    return null;
  }

  /** Apply damage; returns true if killed by this hit. */
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(50, () => { if (!this.dead) this.clearTint(); });
    if (this.hp <= 0) return true;
    this.updateHpBar();
    return false;
  }

  private updateHpBar(): void {
    if (this.hp >= this.maxHp) { this.hpBarBg.setVisible(false); this.hpBar.setVisible(false); return; }
    const by = this.y - 18;
    this.hpBarBg.setPosition(this.x, by).setVisible(true);
    this.hpBar.setPosition(this.x - 13, by).setVisible(true);
    this.hpBar.width = 26 * Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
  }

  destroyAll(): void {
    this.hpBar.destroy();
    this.hpBarBg.destroy();
    this.destroy();
  }
}
