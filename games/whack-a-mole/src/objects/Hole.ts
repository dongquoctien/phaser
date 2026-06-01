import Phaser from 'phaser';
import { AtlasKeys, TexKeys } from '../types/keys';
import { HOLE_H } from '../systems/art';
import type { CharDef } from '../systems/roster';

// One hole in the grid. Three layers stacked at a fixed (x, y = ground line):
//   hole (behind) -> character (middle, rises up) -> mound rim (front, occludes)
//
// No WebGL mask (Phaser 4 dropped geometry masks on sprites). Instead the front
// mound rim is OPAQUE and drawn at a higher depth, so the part of the character
// still "in the hole" is simply hidden behind it — the classic emerge read.
//
// State: idle -> rising -> up (hittable) -> ducking -> idle.

export type HoleState = 'idle' | 'rising' | 'up' | 'ducking';

const POP_RISE = 150; // ms to rise
const POP_DUCK = 120; // ms to duck back

// telegraph halo colors: green = SPARE (friendly), red = BONK (enemy/boss)
const MARK_FRIENDLY = 0x5dd84f;
const MARK_ENEMY = 0xff5a4d;

export class Hole {
  readonly x: number;
  readonly y: number; // ground line (the hole's vertical center)
  state: HoleState = 'idle';
  def: CharDef | null = null;

  private scene: Phaser.Scene;
  private holeImg: Phaser.GameObjects.Image;
  private marker: Phaser.GameObjects.Image; // red/green telegraph halo
  private char: Phaser.GameObjects.Sprite;
  private hitZone: Phaser.GameObjects.Zone;
  private mound: Phaser.GameObjects.Image;
  private riseTween?: Phaser.Tweens.Tween;
  private duckCall?: Phaser.Time.TimerEvent;
  private downY = 0; // char y (bottom origin) when fully hidden
  private upY = 0; // char y when fully popped
  private hit = false;

  onHit?: (hole: Hole, def: CharDef, x: number, y: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    // ground line where the rim's top sits.
    const groundY = y + HOLE_H * 0.1;

    this.holeImg = scene.add.image(x, y, TexKeys.Hole).setDepth(y);

    // Telegraph halo on the ground (between hole and character). Hidden until a
    // character pops; tinted red (bonk) or green (spare). ADD blend = soft glow.
    this.marker = scene.add
      .image(x, groundY - 2, TexKeys.Marker)
      .setDepth(y + 0.5)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Character: origin bottom-center. Popped so its feet tuck just behind the
    // rim; hidden so it's fully below the rim.
    this.char = scene.add
      .sprite(x, y, AtlasKeys.Sprites, 'cat-black')
      .setOrigin(0.5, 1)
      .setDepth(y + 1)
      .setVisible(false);

    // Front rim — opaque, higher depth than the char so it occludes the body.
    this.mound = scene.add
      .image(x, groundY, TexKeys.Mound)
      .setOrigin(0.5, 0) // top edge at the ground line
      .setDepth(y + 2);

    // up/down y are computed per-pop in pop() from the actual sprite height.

    // Interactive hit zone covering the visible popped area (above the rim).
    this.hitZone = scene.add
      .zone(x, groundY - 30, 96, 110)
      .setDepth(y + 3)
      .setInteractive({ useHandCursor: false });
    this.hitZone.on('pointerdown', this.handlePointer, this);
    this.hitZone.disableInteractive();
  }

  get isAvailable(): boolean {
    return this.state === 'idle';
  }

  pop(def: CharDef, upMs: number): boolean {
    if (this.state !== 'idle') return false;
    this.def = def;
    this.hit = false;
    this.char.setFrame(def.frame);
    this.char.setScale(1);
    this.char.setVisible(true).setAlpha(1);

    // telegraph: green halo for friendlies (spare!), red for enemies/boss (bonk)
    this.marker
      .setVisible(true)
      .setTint(def.kind === 'friendly' ? MARK_FRIENDLY : MARK_ENEMY)
      .setAlpha(0.9)
      .setScale(0.6);
    this.scene.tweens.killTweensOf(this.marker);
    this.scene.tweens.add({
      targets: this.marker,
      scale: 1,
      duration: POP_RISE,
      ease: 'Back.easeOut',
    });

    const groundY = this.y + HOLE_H * 0.1;
    const h = this.char.displayHeight;
    // hidden: bottom origin sits BELOW the ground so the whole body is under the
    // rim (we push it down by most of its height).
    this.downY = groundY + h * 0.9;
    // popped: bottom sits a little below the rim line so feet stay hidden but
    // the head/torso clear it.
    this.upY = groundY + 14;

    this.char.y = this.downY;
    this.state = 'rising';

    this.riseTween = this.scene.tweens.add({
      targets: this.char,
      y: this.upY,
      duration: POP_RISE,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (this.state === 'rising') this.state = 'up';
      },
    });
    this.hitZone.setInteractive();

    this.duckCall = this.scene.time.delayedCall(upMs, () => {
      if (this.state === 'up' || this.state === 'rising') this.duck(false);
    });
    return true;
  }

  private handlePointer(): void {
    if ((this.state !== 'up' && this.state !== 'rising') || this.hit || !this.def) return;
    this.hit = true;
    const def = this.def;
    this.scene.tweens.killTweensOf(this.char);
    // bonk squash
    this.scene.tweens.add({
      targets: this.char,
      scaleX: 1.3,
      scaleY: 0.65,
      duration: 70,
      ease: 'Quad.easeOut',
    });
    this.onHit?.(this, def, this.char.x, this.upY - this.char.displayHeight * 0.55);
    this.duck(true);
  }

  duck(wasHit: boolean): void {
    if (this.state === 'idle' || this.state === 'ducking') return;
    this.state = 'ducking';
    this.hitZone.disableInteractive();
    this.riseTween?.stop();
    this.duckCall?.remove();
    // fade the telegraph halo out as the character ducks
    this.scene.tweens.killTweensOf(this.marker);
    this.scene.tweens.add({
      targets: this.marker,
      alpha: 0,
      duration: wasHit ? 90 : POP_DUCK,
      onComplete: () => this.marker.setVisible(false),
    });
    this.scene.tweens.add({
      targets: this.char,
      y: this.downY,
      duration: wasHit ? 90 : POP_DUCK,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.char.setVisible(false).setScale(1);
        this.state = 'idle';
        this.def = null;
      },
    });
  }

  reset(): void {
    this.scene.tweens.killTweensOf(this.char);
    this.scene.tweens.killTweensOf(this.marker);
    this.duckCall?.remove();
    this.hitZone.disableInteractive();
    this.char.setVisible(false).setScale(1);
    this.marker.setVisible(false);
    this.state = 'idle';
    this.def = null;
    this.hit = false;
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.char);
    this.scene.tweens.killTweensOf(this.marker);
    this.duckCall?.remove();
    this.char.destroy();
    this.marker.destroy();
    this.holeImg.destroy();
    this.mound.destroy();
    this.hitZone.destroy();
  }
}
