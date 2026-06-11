import Phaser from 'phaser';
import { PooledSprite } from './PooledSprite';
import { MONSTERS } from '../types/keys';

// A roaming overworld monster. Wanders the meadow, and when the player gets within
// AGGRO range it turns and chases — touching the player triggers a battle. Each mob
// is randomly one of the MONSTERS types; it carries its type index so the battle
// knows which enemy sprite/stats to use. Pooled so a busy field never allocates.
const WANDER_SPEED = 26;
const CHASE_SPEED = 50;
const AGGRO = 96;
const REPATH_MS = 1400;

export class Mob extends PooledSprite {
  private nextRepath = 0;
  private heading = new Phaser.Math.Vector2(1, 0);
  typeIndex = 0; // index into MONSTERS

  constructor(scene: Phaser.Scene) {
    super(scene, MONSTERS[0].idle, undefined);
    this.setDepth(5);
  }

  spawn(x: number, y: number): void {
    super.spawn(x, y);
    this.typeIndex = Phaser.Math.Between(0, MONSTERS.length - 1);
    this.setTexture(MONSTERS[this.typeIndex].idle);
    this.setScale(0.7).setDepth(5);
    // body ~ the lower-middle blob of the 32×32 sprite (×4 px ×0.7 scale)
    const bw = this.width * 0.5, bh = this.height * 0.4;
    this.body?.setSize(bw, bh);
    this.nextRepath = 0;
  }

  /** Called every frame by the Pool (runChildUpdate). */
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    // idle bob — subtle vertical squash via scaleY around 0.7
    this.scaleY = 0.7 + Math.sin(time * 0.006 + this.x) * 0.03;

    const player = (this.scene as Phaser.Scene & { playerPos?: Phaser.Math.Vector2 }).playerPos;
    if (player) {
      const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      if (d < AGGRO) {
        this.scene.physics.moveTo(this, player.x, player.y, CHASE_SPEED);
        this.faceVelocity();
        return;
      }
    }
    if (time >= this.nextRepath) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.heading.set(Math.cos(a), Math.sin(a));
      this.nextRepath = time + REPATH_MS + Phaser.Math.Between(0, 600);
    }
    this.setVelocity(this.heading.x * WANDER_SPEED, this.heading.y * WANDER_SPEED);
    this.faceVelocity();
  }

  private faceVelocity(): void {
    const vx = this.body?.velocity.x ?? 0;
    if (Math.abs(vx) > 1) this.setFlipX(vx < 0);
  }
}
