import Phaser from 'phaser';
import { PARTY } from '../types/keys';

// The party leader (Rem) plus a trailing line of followers (Hollis, Moz) that
// snake along the leader's recent path — the classic JRPG overworld "caterpillar".
// Movement is 4/8-directional via arcade velocity; sprites flip to face heading.
// Sprites are the baked 32×32 pixel art (×4 px = 128 tall), shown small on the field.
const SPEED = 108;
const LEAD_SCALE = 0.46;
const FOLLOW_SCALE = 0.42;
const FOLLOW_GAP = 15; // px of path between each party member
const BOB_AMP = 1.5; // subtle walk bob for life

export class Player {
  readonly leader: Phaser.Physics.Arcade.Sprite;
  readonly pos = new Phaser.Math.Vector2();
  private followers: Phaser.GameObjects.Sprite[] = [];
  private trail: { x: number; y: number }[] = [];
  private moving = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.leader = scene.physics.add.sprite(x, y, PARTY[0]).setOrigin(0.5, 0.88);
    this.leader.setScale(LEAD_SCALE).setDepth(10);
    const b = this.leader.body as Phaser.Physics.Arcade.Body;
    b.setSize(this.leader.width * 0.34, this.leader.height * 0.22);
    b.setOffset(this.leader.width * 0.33, this.leader.height * 0.64);
    b.setCollideWorldBounds(true);

    for (const key of [PARTY[1], PARTY[2]]) {
      const f = scene.add.sprite(x, y, key).setOrigin(0.5, 0.88).setScale(FOLLOW_SCALE).setDepth(9);
      this.followers.push(f);
    }
    this.pos.set(x, y);
  }

  /** Drive from an input vector (already normalized direction, length 0..1). */
  move(dirX: number, dirY: number): void {
    const len = Math.hypot(dirX, dirY);
    this.moving = len > 0.01;
    if (this.moving) {
      this.leader.setVelocity((dirX / len) * SPEED, (dirY / len) * SPEED);
      if (Math.abs(dirX) > 0.01) this.leader.setFlipX(dirX < 0);
    } else {
      this.leader.setVelocity(0, 0);
    }
  }

  /** Call every frame after physics: record the trail + place followers on it. */
  update(time: number): void {
    this.pos.set(this.leader.x, this.leader.y);

    // record a breadcrumb when the leader has moved enough
    const last = this.trail[0];
    if (!last || Phaser.Math.Distance.Between(last.x, last.y, this.leader.x, this.leader.y) >= 2) {
      this.trail.unshift({ x: this.leader.x, y: this.leader.y });
      const maxLen = FOLLOW_GAP * (this.followers.length + 1) + 8;
      if (this.trail.length > maxLen) this.trail.length = maxLen;
    }

    this.followers.forEach((f, i) => {
      const idx = Math.min(this.trail.length - 1, FOLLOW_GAP * (i + 1));
      const p = this.trail[idx];
      if (!p) return;
      const prevX = f.x;
      f.setPosition(p.x, p.y);
      if (Math.abs(p.x - prevX) > 0.2) f.setFlipX(p.x - prevX < 0);
      // gentle walk bob while the party is moving
      f.y += this.moving ? Math.sin(time * 0.012 + i * 1.5) * BOB_AMP : 0;
    });
    // leader bob too
    if (this.moving) this.leader.y += Math.sin(time * 0.012) * BOB_AMP * 0.5;
  }

  destroy(): void {
    this.leader.destroy();
    this.followers.forEach((f) => f.destroy());
    this.followers = [];
    this.trail = [];
  }
}
