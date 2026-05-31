import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';
import { Tuning } from '../tuning';

// The player. The ONLY entity with an Arcade body (used for world-bounds clamp +
// simple velocity movement). Carries mutable stats that skills upgrade.
export class Hero extends Phaser.Physics.Arcade.Sprite {
  hp: number = Tuning.heroMaxHp;
  maxHp: number = Tuning.heroMaxHp;
  speed: number = Tuning.heroSpeed;
  pickupRadius: number = Tuning.heroPickupRadius;
  private iframeUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.Hero);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(Tuning.heroRadius, this.width / 2 - Tuning.heroRadius, this.height / 2 - Tuning.heroRadius);
    body.setCollideWorldBounds(true);
    this.setDepth(10);
  }

  /** Move from a normalized direction vector (dx,dy in [-1,1]). */
  drive(dx: number, dy: number): void {
    this.setVelocity(dx * this.speed, dy * this.speed);
    // Face the movement direction (the gun sprite points up at frame 0).
    if (dx !== 0 || dy !== 0) this.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
  }

  /** Apply damage if not in i-frames. Returns true if it landed. */
  hurt(amount: number, now: number): boolean {
    if (now < this.iframeUntil) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.iframeUntil = now + Tuning.heroHitIFrames;
    // Phaser 4: setTintFill was removed → setTint + FILL mode.
    this.setTint(0xff5555).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(90, () => this.clearTint());
    return true;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }
}
