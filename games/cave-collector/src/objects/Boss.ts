import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';

// The brass GUARDIAN BOSS — a hovering turret that guards the Story finale's exit.
// Cycle: idle → wind-up (telegraph, ~0.8s) → attack (a laser beam toward the hero) →
// cooldown. It has HP; the hero damages it by STOMPING the top (each stomp = 1 hit,
// HP default 4). On death it explodes and the path to the door opens.
//
// The attack shows a dedicated boss+laser IMAGE (Tex.BossShoot) for the beam: the
// atlas boss hides, the shoot image is placed so its boss-head sits exactly over the
// boss, and a hurt-zone body covers the image's beam strip (the GameScene overlaps it).
const HP = 4;
const CYCLE_MS = 2600;     // idle → telegraph → fire period
const TELEGRAPH_MS = 800;  // wind-up before the beam
const BEAM_MS = 350;       // how long the beam is live

// Geometry of the boss-shoot image (boss on the RIGHT, beam firing LEFT), in source px.
// Measured from Guardian boss-trans-shoot.png (1913x287): boss bbox x≈1640..1906,
// beam horizontal center at y≈171, beam reaches from x≈0 to the muzzle (~x1691).
const SHOOT = {
  imgW: 1913, imgH: 287,
  bossCx: 1773, bossCy: 140, // boss-head center → image origin
  bossW: 266,                // boss-head width in source px (for scale matching)
  beamCenterY: 171,          // beam horizontal axis in source px
  beamLeftX: 4, beamRightX: 1691, // beam strip extent in source px
  beamHalfThick: 14,         // half the beam's vertical thickness in source px
};

export class Boss extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  public hp = HP;
  public readonly stompable = true; // can be jumped on (that's how you damage it)
  private shootImg?: Phaser.GameObjects.Image;          // boss+laser attack picture
  private beam?: Phaser.GameObjects.Zone & { body: Phaser.Physics.Arcade.Body }; // hurt-zone
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

    // the boss+laser attack image — hidden until fired. Its origin is the boss-head
    // center so positioning it at the boss puts the head exactly on top.
    const img = this.scene.add.image(0, 0, Tex.BossShoot)
      .setOrigin(SHOOT.bossCx / SHOOT.imgW, SHOOT.bossCy / SHOOT.imgH)
      .setDepth(9) // just above the atlas boss
      .setVisible(false);
    this.shootImg = img;

    // invisible hurt-zone covering the beam strip; sized/placed when firing.
    const zone = this.scene.add.zone(0, 0, 4, 4).setOrigin(1, 0.5);
    this.scene.physics.add.existing(zone);
    const zb = zone.body as Phaser.Physics.Arcade.Body;
    zb.setAllowGravity(false);
    zb.enable = false;
    this.beam = zone as typeof this.beam;

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
    this.shootImg?.setTint(0xff8080);
    this.scene.time.delayedCall(120, () => { this.clearTint(); this.shootImg?.clearTint(); });
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  private beginAttack(): void {
    if (!this.active) return;
    this.play(Anim.BossWindup, true);
    this.scene.time.delayedCall(TELEGRAPH_MS, () => this.fire());
  }

  private fire(): void {
    if (!this.active || !this.shootImg || !this.beam) return;
    this.emit('fire'); // GameScene plays the laser SFX

    // scale the shoot image so its boss-head matches the atlas boss width, then place
    // it so the head sits over the real boss. The atlas boss hides (the image has one).
    const scale = this.displayWidth / SHOOT.bossW;
    const headCenterY = this.y - this.displayHeight * 0.5; // atlas boss vertical center
    this.shootImg.setScale(scale).setPosition(this.x, headCenterY).setVisible(true);
    this.setVisible(false);

    // hurt-zone over the beam strip. Map source-px beam extent → world via the image
    // transform: world = imgPos + (srcPx - origin) * scale.
    const ox = SHOOT.bossCx, oy = SHOOT.bossCy; // origin in source px
    const beamRightWorld = this.x + (SHOOT.beamRightX - ox) * scale;
    const beamLeftWorld = this.x + (SHOOT.beamLeftX - ox) * scale;
    const beamCenterWorldY = headCenterY + (SHOOT.beamCenterY - oy) * scale;
    const len = beamRightWorld - beamLeftWorld;
    const thick = SHOOT.beamHalfThick * 2 * scale;

    this.beam.setPosition(beamRightWorld, beamCenterWorldY).setSize(len, thick);
    const body = this.beam.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setSize(len, thick);
    body.updateFromGameObject();

    this.scene.time.delayedCall(BEAM_MS, () => {
      this.shootImg?.setVisible(false);
      if (this.beam) this.beam.body.enable = false;
      if (this.active) { this.setVisible(true); this.play(Anim.BossIdle, true); }
    });
  }

  /** The active beam hurt-zone (for the GameScene overlap), or null when idle. */
  get beamZone(): Phaser.GameObjects.Zone | undefined {
    return this.beam && this.beam.body.enable ? this.beam : undefined;
  }

  private die(): void {
    this.emit('died', this.x, this.y);
    this.destroy(); // destroy() removes the timer + beam + image
  }

  destroy(fromScene?: boolean): void {
    this.timer?.remove();
    this.beam?.destroy();
    this.shootImg?.destroy();
    this.beam = undefined;
    this.shootImg = undefined;
    super.destroy(fromScene);
  }
}
