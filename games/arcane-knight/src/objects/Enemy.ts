import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';
import type { EnemyType } from '../levels';

// A platformer enemy. Slimes/skeletons patrol the ground turning at edges/walls;
// bats hover-bob and drift toward the player horizontally. Contact damages the
// hero; the hero's attack/projectile damages it. Simple HP, hit-flash, death pop.
const STATS: Record<EnemyType, { hp: number; speed: number; tex: string; anim: string; fly: boolean; scale: number }> = {
  slime:    { hp: 2, speed: 34, tex: Tex.Slime0,    anim: Anim.SlimeMove, fly: false, scale: 1 },
  skeleton: { hp: 3, speed: 40, tex: Tex.Skeleton0, anim: Anim.SkelWalk,  fly: false, scale: 1 },
  bat:      { hp: 2, speed: 52, tex: Tex.Bat0,      anim: Anim.BatFly,    fly: true,  scale: 1 },
};

export class Enemy {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  type: EnemyType;
  alive = true;
  private speed: number;
  private fly: boolean;
  private dir: 1 | -1 = -1;
  private baseY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType) {
    this.type = type;
    const s = STATS[type];
    this.hp = s.hp;
    this.speed = s.speed;
    this.fly = s.fly;
    this.baseY = y;
    this.sprite = scene.physics.add.sprite(x, y, s.tex).setOrigin(0.5, 1).play(s.anim);
    const b = this.sprite.body as Phaser.Physics.Arcade.Body;
    b.setSize(this.sprite.width * 0.4, this.sprite.height * 0.4);
    b.setOffset(this.sprite.width * 0.3, this.sprite.height * 0.55);
    if (this.fly) { b.setAllowGravity(false); }
    this.sprite.setData('ref', this);
  }

  update(now: number, playerX: number): void {
    if (!this.alive) return;
    const b = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.fly) {
      this.dir = playerX < this.sprite.x ? -1 : 1;
      b.setVelocityX(this.speed * this.dir);
      this.sprite.y = this.baseY + Math.sin(now * 0.005 + this.sprite.x) * 14;
      b.setVelocityY(0);
    } else {
      // turn at walls or ledges
      if (b.blocked.left) this.dir = 1;
      else if (b.blocked.right) this.dir = -1;
      b.setVelocityX(this.speed * this.dir);
    }
    this.sprite.setFlipX(this.dir === 1);
  }

  hurt(dmg: number): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    const spr = this.sprite;
    spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    spr.scene.time.delayedCall(80, () => { if (spr.active) { spr.clearTint(); spr.setTintMode(Phaser.TintModes.MULTIPLY); } });
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  private die(): void {
    this.alive = false;
    const b = this.sprite.body as Phaser.Physics.Arcade.Body;
    b.enable = false;
    this.sprite.scene.tweens.add({
      targets: this.sprite, angle: 180, alpha: 0, y: this.sprite.y - 10, scaleX: 0.6, scaleY: 0.6,
      duration: 320, onComplete: () => this.sprite.destroy(),
    });
  }
}
