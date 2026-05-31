import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';
import { Tuning } from '../tuning';
import type { HashItem } from '../systems/SpatialHash';

export type EnemyKind = 'walker' | 'runner' | 'boss';

interface KindSpec {
  texture: string;
  speed: number;
  hp: number;
  radius: number;
  damage: number;
  scale: number;
}

const SPECS: Record<EnemyKind, KindSpec> = {
  walker: {
    texture: TextureKeys.Walker, speed: Tuning.enemyWalkerSpeed, hp: Tuning.enemyWalkerHp,
    radius: Tuning.enemyWalkerRadius, damage: Tuning.enemyContactDamage, scale: 1,
  },
  runner: {
    texture: TextureKeys.Runner, speed: Tuning.enemyRunnerSpeed, hp: Tuning.enemyRunnerHp,
    radius: Tuning.enemyRunnerRadius, damage: Tuning.enemyContactDamage, scale: 0.9,
  },
  boss: {
    texture: TextureKeys.Boss, speed: Tuning.bossSpeed, hp: Tuning.bossHp,
    radius: Tuning.bossRadius, damage: Tuning.bossContactDamage, scale: 1.8,
  },
};

// A pooled enemy. Plain Image (no physics body) — movement + collision are
// handled manually via the spatial hash, which scales to hundreds of enemies.
export class Enemy extends Phaser.GameObjects.Image implements HashItem {
  kind: EnemyKind = 'walker';
  hp = 0;
  speed = 0;
  radius = 0;
  damage = 0;
  private flashUntil = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKeys.Walker);
    this.setActive(false).setVisible(false);
  }

  spawn(
    kind: EnemyKind,
    x: number,
    y: number,
    hpScale: number,
    hpMul = 1,
    dmgMul = 1,
  ): void {
    const s = SPECS[kind];
    this.kind = kind;
    this.hp = Math.round(s.hp * hpScale * hpMul);
    this.speed = s.speed;
    this.radius = s.radius;
    this.damage = s.damage * dmgMul;
    this.setTexture(s.texture); // sprite is pre-colored — no base tint needed
    this.setScale(s.scale);
    this.clearTint();
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.setDepth(kind === 'boss' ? 6 : 5);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
    this.clearTint();
  }

  /** Apply damage; returns true if this hit killed it. */
  takeDamage(amount: number, now: number): boolean {
    this.hp -= amount;
    // White hit-flash (Phaser 4: setTint + FILL mode; setTintFill removed).
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.flashUntil = now + 60;
    return this.hp <= 0;
  }

  /** Steer toward (tx,ty); call each frame. Also face the hero. */
  moveToward(tx: number, ty: number, dt: number, now: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const len = Math.hypot(dx, dy) || 1;
    this.x += (dx / len) * this.speed * dt;
    this.y += (dy / len) * this.speed * dt;
    this.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    // End the hit-flash by clearing the white fill (sprite is pre-colored).
    if (this.flashUntil !== 0 && now > this.flashUntil) {
      this.flashUntil = 0;
      this.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    }
  }
}
