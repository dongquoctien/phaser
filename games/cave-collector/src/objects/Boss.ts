import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';

// The brass GUARDIAN BOSS — a hovering turret that guards the Story finale's exit.
// Cycle: idle → wind-up (telegraph, ~0.8s) → attack (a laser beam toward the hero) →
// cooldown. It has HP; the hero damages it by STOMPING the top (each stomp = 1 hit,
// HP default 4). On death it explodes and the path to the door opens. The laser is
// a short-lived hurt-zone the GameScene overlaps with the hero.
const HP = 4;
const CYCLE_MS = 2600;     // idle → telegraph → fire period
const TELEGRAPH_MS = 800;  // wind-up before the beam
const BEAM_MS = 350;       // how long the beam is live
const LASER_LEN = 280;     // beam length in px (~17 tiles — reaches across the arena)

export class Boss extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  public hp = HP;
  public readonly stompable = true; // can be jumped on (that's how you damage it)
  private beam?: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
  private beamCore?: Phaser.GameObjects.Rectangle;
  private timer?: Phaser.Time.TimerEvent;
  private hitCooldown = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, Tex.Boss, 0);
    scene.add.existing(this);     // display list — WITHOUT this the boss never renders
    scene.physics.add.existing(this);
    this.setDepth(8);
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, y: number): void {
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.setScale(0.9).setOrigin(0.5, 1);
    this.body.setAllowGravity(false);
    this.body.setSize(40, 44).setOffset(4, 2);
    this.setPosition(x, y);
    this.hp = HP;
    this.play(Anim.BossIdle, true);

    // laser beam rectangle, reused; right edge anchored at the boss muzzle, grows left.
    const beam = this.scene.add.rectangle(0, 0, 4, 4, 0xff4d4d, 0.9)
      .setOrigin(1, 0.5).setDepth(45).setVisible(false);
    this.scene.physics.add.existing(beam);
    const beamBody = beam.body as Phaser.Physics.Arcade.Body;
    beamBody.setAllowGravity(false);
    beamBody.enable = false;
    this.beam = beam as typeof this.beam;

    // a brighter core line drawn over the beam so the laser reads as a hot bolt,
    // not a flat red bar (same right-anchored origin so it tracks the beam exactly).
    const core = this.scene.add.rectangle(0, 0, 4, 2, 0xffe0e0, 1)
      .setOrigin(1, 0.5).setDepth(46).setVisible(false);
    this.beamCore = core;

    // attack loop
    this.timer = this.scene.time.addEvent({ delay: CYCLE_MS, loop: true, callback: () => this.beginAttack() });
  }

  /** Stomp damages it; returns true if it died this hit. */
  takeStomp(): boolean {
    if (this.hitCooldown > this.scene.time.now) return false;
    this.hitCooldown = this.scene.time.now + 400;
    this.hp -= 1;
    this.scene.cameras.main.shake(120, 0.006);
    this.setTint(0xff8080);
    this.scene.time.delayedCall(120, () => this.clearTint());
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  private beginAttack(): void {
    if (!this.active) return;
    this.play(Anim.BossWindup, true);
    this.scene.time.delayedCall(TELEGRAPH_MS, () => this.fire());
  }

  private fire(): void {
    if (!this.active || !this.beam) return;
    this.play(Anim.BossAttack, true);
    this.emit('fire'); // GameScene plays the laser SFX
    // beam shoots LEFT (toward the level / hero) from the boss muzzle.
    const muzzleX = this.x - this.displayWidth * 0.45; // right edge of the beam
    const eyeY = this.y - this.displayHeight * 0.55;
    const len = LASER_LEN;
    const thick = 10;

    // glow body: right edge pinned at the muzzle (origin 1,0.5), so it stretches left.
    this.beam.setPosition(muzzleX, eyeY).setSize(len, thick).setVisible(true);
    this.beamCore?.setPosition(muzzleX, eyeY).setSize(len, 4).setVisible(true);

    // sync the physics body to the (origin 1,0.5) rectangle's visual bounds. Setting
    // body size + offset (NOT body.reset, which would yank the GameObject) keeps the
    // hurt-zone exactly under the drawn beam: left = muzzle-len, top = eyeY-thick/2.
    const body = this.beam.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setSize(len, thick);
    body.setOffset(0, 0); // origin (1,0.5): display top-left is already (x-width, y-h/2)
    body.updateFromGameObject();

    this.scene.time.delayedCall(BEAM_MS, () => {
      if (this.beam) { this.beam.setVisible(false); this.beam.body.enable = false; }
      this.beamCore?.setVisible(false);
      if (this.active) this.play(Anim.BossIdle, true);
    });
  }

  /** The active beam rectangle (for the GameScene overlap), or null when idle. */
  get beamZone(): Phaser.GameObjects.Rectangle | undefined {
    return this.beam && this.beam.visible ? this.beam : undefined;
  }

  private die(): void {
    this.emit('died', this.x, this.y);
    this.destroy(); // destroy() removes the timer + beam
  }

  destroy(fromScene?: boolean): void {
    this.timer?.remove();
    this.beam?.destroy();
    this.beamCore?.destroy();
    this.beam = undefined;
    this.beamCore = undefined;
    super.destroy(fromScene);
  }
}
