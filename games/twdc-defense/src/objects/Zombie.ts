import Phaser from 'phaser';
import { type ZombieDef } from '../types/roster';

// A pooled zombie that walks the waypoint path. Plain Image moved manually (no
// physics body). Carries status effects layered by hero skills: slow, poison
// (DoT), stun, knockback. Heroes query it via the scene's zombie list.
export class Zombie extends Phaser.GameObjects.Image {
  hp = 0;
  maxHp = 0;
  baseSpeed = 0;
  bounty = 0;
  dead = true;
  reachedEnd = false;

  // status
  private slowFactor = 1; // 1 = normal; <1 = slowed
  private slowUntil = 0;
  private stunUntil = 0;
  private poisonDps = 0;
  private poisonUntil = 0;
  private dist = 0; // distance travelled along the path (px), for knockback + targeting order

  private wpIndex = 0;
  private waypoints: { x: number; y: number }[] = [];
  private segLen: number[] = [];
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpBarBg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'zombie-walker');
    this.setActive(false).setVisible(false);
    this.hpBarBg = scene.add.rectangle(0, 0, 26, 4, 0x1a1c2c).setDepth(15).setVisible(false);
    this.hpBar = scene.add.rectangle(0, 0, 24, 2, 0xb13e53).setOrigin(0, 0.5).setDepth(16).setVisible(false);
  }

  spawn(def: ZombieDef, hp: number, baseSpeed: number, bountyBase: number, waypoints: { x: number; y: number }[]): void {
    this.setTexture(def.tex).setScale(def.scale);
    this.hp = hp;
    this.maxHp = hp;
    this.baseSpeed = baseSpeed * def.speedMul;
    this.bounty = Math.round(bountyBase * def.bounty);
    this.waypoints = waypoints;
    this.wpIndex = 0;
    this.dist = 0;
    this.dead = false;
    this.reachedEnd = false;
    this.slowFactor = 1; this.slowUntil = 0; this.stunUntil = 0;
    this.poisonDps = 0; this.poisonUntil = 0;
    // precompute segment lengths for distance-based ordering
    this.segLen = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      this.segLen.push(Phaser.Math.Distance.BetweenPoints(waypoints[i], waypoints[i + 1]));
    }
    const wp0 = waypoints[0];
    this.setPosition(wp0.x, wp0.y).setActive(true).setVisible(true).setDepth(10).clearTint();
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

  /** Total distance travelled along the path — used to target the FRONT zombie. */
  get progress(): number { return this.dist; }

  /** Step toward the next waypoint. Returns 'end' if it reached the exit. */
  step(dt: number, now: number): 'end' | null {
    if (this.dead) return null;

    // poison DoT
    if (this.poisonUntil > now && this.poisonDps > 0) {
      if (this.applyDamage(this.poisonDps * dt)) return null; // killed → caller reads dead via list filter
    }

    // stunned → no movement (but still flashes)
    if (this.stunUntil > now) { this.updateBars(); return null; }

    const speed = this.baseSpeed * (this.slowUntil > now ? this.slowFactor : 1);
    let move = speed * dt;
    while (move > 0) {
      const target = this.waypoints[this.wpIndex + 1];
      if (!target) { this.reachedEnd = true; return 'end'; }
      const dx = target.x - this.x, dy = target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= move) {
        this.setPosition(target.x, target.y);
        this.dist += d;
        this.wpIndex += 1;
        move -= d;
      } else {
        this.x += (dx / d) * move;
        this.y += (dy / d) * move;
        this.setRotation(0); // zombies stay upright (top-down readable)
        this.dist += move;
        move = 0;
      }
    }
    this.updateBars();
    return null;
  }

  /** Apply a flat damage amount; returns true if this killed it. */
  applyDamage(amount: number): boolean {
    if (this.dead) return false;
    this.hp -= amount;
    this.flash();
    if (this.hp <= 0) { this.hp = 0; return true; }
    this.updateBars();
    return false;
  }

  applySlow(factor: number, durationS: number, now: number): void {
    // strongest slow wins; refresh duration
    this.slowFactor = Math.min(this.slowFactor === 1 ? factor : this.slowFactor, factor);
    this.slowUntil = Math.max(this.slowUntil, now + durationS * 1000);
    this.setTint(0x9be0ff);
    this.scene.time.delayedCall(120, () => { if (!this.dead && this.slowUntil <= this.scene.time.now) this.clearTint(); });
  }

  applyPoison(dps: number, durationS: number, now: number): void {
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonUntil = Math.max(this.poisonUntil, now + durationS * 1000);
  }

  applyStun(durationS: number, now: number): void {
    this.stunUntil = Math.max(this.stunUntil, now + durationS * 1000);
    this.setTint(0xffe066);
    this.scene.time.delayedCall(durationS * 1000, () => { if (!this.dead) this.clearTint(); });
  }

  /** Push the zombie back along the path (rewind waypoints by `px`). */
  knockBack(px: number): void {
    if (this.dead) return;
    let back = px;
    while (back > 0 && this.wpIndex >= 0) {
      const prev = this.waypoints[this.wpIndex];
      const dx = this.x - prev.x, dy = this.y - prev.y;
      const d = Math.hypot(dx, dy);
      if (d >= back) {
        this.x -= (dx / (d || 1)) * back;
        this.y -= (dy / (d || 1)) * back;
        this.dist = Math.max(0, this.dist - back);
        back = 0;
      } else {
        this.setPosition(prev.x, prev.y);
        this.dist = Math.max(0, this.dist - d);
        back -= d;
        if (this.wpIndex > 0) this.wpIndex -= 1; else back = 0;
      }
    }
    this.updateBars();
  }

  private flash(): void {
    this.setTint(0xffffff);
    this.scene.time.delayedCall(45, () => {
      if (this.dead) return;
      // restore a status tint if one is active, else clear
      if (this.stunUntil > this.scene.time.now) this.setTint(0xffe066);
      else if (this.slowUntil > this.scene.time.now) this.setTint(0x9be0ff);
      else this.clearTint();
    });
  }

  private updateBars(): void {
    if (this.hp >= this.maxHp) { this.hpBarBg.setVisible(false); this.hpBar.setVisible(false); return; }
    const by = this.y - 16;
    this.hpBarBg.setPosition(this.x, by).setVisible(true);
    this.hpBar.setPosition(this.x - 12, by).setVisible(true);
    this.hpBar.width = 24 * Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
  }

  destroyAll(): void {
    this.hpBar.destroy();
    this.hpBarBg.destroy();
    this.destroy();
  }
}
