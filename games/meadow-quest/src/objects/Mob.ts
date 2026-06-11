import Phaser from 'phaser';
import { PooledSprite } from './PooledSprite';
import { CharKeys, AnimKeys } from '../types/keys';

// A roaming overworld monster. Wanders the meadow on a random heading, and when
// the player gets within AGGRO range it turns and chases — touching the player
// triggers a battle (handled by GameScene's overlap). Pooled so a busy field
// never allocates in the loop.
const WANDER_SPEED = 28;
const CHASE_SPEED = 52;
const AGGRO = 90; // px — start chasing inside this radius
const REPATH_MS = 1400; // pick a new wander heading this often

export class Mob extends PooledSprite {
  private nextRepath = 0;
  private heading = new Phaser.Math.Vector2(1, 0);

  constructor(scene: Phaser.Scene) {
    super(scene, CharKeys.MobWalker, undefined);
    this.setScale(0.34); // 118×141 source → ~40×48 on screen, matches the heroes
    // tighten the body to the visible torso so encounters feel fair
    const bw = this.width * 0.42, bh = this.height * 0.5;
    this.body?.setSize(bw, bh);
    this.setDepth(5);
  }

  spawn(x: number, y: number): void {
    super.spawn(x, y);
    this.setScale(0.34).setDepth(5);
    this.nextRepath = 0;
    this.play(AnimKeys.MobWalk, true);
  }

  /** Called every frame by the Pool (runChildUpdate). */
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    const player = (this.scene as Phaser.Scene & { playerPos?: Phaser.Math.Vector2 }).playerPos;
    if (player) {
      const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      if (d < AGGRO) {
        // chase: head straight for the player
        this.scene.physics.moveTo(this, player.x, player.y, CHASE_SPEED);
        this.faceVelocity();
        return;
      }
    }
    // wander: re-pick a random heading every so often
    if (time >= this.nextRepath) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.heading.set(Math.cos(a), Math.sin(a));
      this.nextRepath = time + REPATH_MS + Phaser.Math.Between(0, 600);
    }
    this.setVelocity(this.heading.x * WANDER_SPEED, this.heading.y * WANDER_SPEED);
    this.faceVelocity();
  }

  /** Flip to face movement direction (sheet faces left by default). */
  private faceVelocity(): void {
    const vx = this.body?.velocity.x ?? 0;
    if (Math.abs(vx) > 1) this.setFlipX(vx > 0);
  }
}
