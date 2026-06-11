import Phaser from 'phaser';
import { SceneKeys, Tex, Anim, RegistryKeys, type HeroId } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// Choose your hero before the adventure. Two cards (Warrior / Magician) with the
// idle sprite, name, and a one-line playstyle. Left/Right + Enter, or click a card.
interface Choice { id: HeroId; name: string; blurb: string; idle: string; anim: string; tint: number; }

const CHOICES: Choice[] = [
  { id: 'warrior',  name: 'WARRIOR',  blurb: 'Melee — sword slash, sturdy', idle: Tex.WarIdle0, anim: Anim.WarIdle, tint: 0x3b5dc9 },
  { id: 'magician', name: 'MAGICIAN', blurb: 'Ranged — cast bolts, fragile', idle: Tex.MagIdle0, anim: Anim.MagIdle, tint: 0x5d275d },
];

export class HeroSelectScene extends Phaser.Scene {
  private sel = 0;
  private cards: Phaser.GameObjects.Container[] = [];

  constructor() { super(SceneKeys.HeroSelect); }

  create(): void {
    this.sel = 0;
    this.cards = [];
    this.cameras.main.setBackgroundColor('#10131f');
    this.add.text(GAME_WIDTH / 2, 26, 'CHOOSE YOUR HERO', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffcd75',
    }).setOrigin(0.5);

    const cardW = 150, cardH = 150, gap = 36;
    const totalW = cardW * 2 + gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const cy = GAME_HEIGHT / 2 + 8;

    CHOICES.forEach((c, i) => {
      const x = startX + i * (cardW + gap);
      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x1a1c2c).setStrokeStyle(3, 0x333c57);
      const tintBar = this.add.rectangle(0, -cardH / 2 + 6, cardW, 6, c.tint).setOrigin(0.5);
      const spr = this.add.sprite(0, -8, c.idle).setScale(1.8).play(c.anim);
      const name = this.add.text(0, 44, c.name, { fontFamily: 'monospace', fontSize: '15px', color: '#f4f4f4' }).setOrigin(0.5);
      const blurb = this.add.text(0, 62, c.blurb, { fontFamily: 'monospace', fontSize: '8px', color: '#94b0c2' }).setOrigin(0.5);
      const card = this.add.container(x, cy, [bg, tintBar, spr, name, blurb]).setSize(cardW, cardH).setInteractive();
      card.on('pointerover', () => { this.sel = i; this.refresh(); });
      card.on('pointerup', () => { this.sel = i; this.confirm(); });
      this.cards.push(card);
    });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18, '◄ ►  choose      ENTER / tap  start', {
      fontFamily: 'monospace', fontSize: '9px', color: '#566c86',
    }).setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => { this.sel = 0; this.refresh(); });
    kb.on('keydown-RIGHT', () => { this.sel = 1; this.refresh(); });
    kb.on('keydown-A', () => { this.sel = 0; this.refresh(); });
    kb.on('keydown-D', () => { this.sel = 1; this.refresh(); });
    kb.on('keydown-ENTER', () => this.confirm());
    kb.on('keydown-SPACE', () => this.confirm());

    this.refresh();
  }

  private refresh(): void {
    this.cards.forEach((card, i) => {
      const bg = card.getAt(0) as Phaser.GameObjects.Rectangle;
      const on = i === this.sel;
      bg.setStrokeStyle(3, on ? 0xffcd75 : 0x333c57);
      card.setScale(on ? 1.06 : 1);
    });
  }

  private confirm(): void {
    const c = CHOICES[this.sel];
    this.registry.set(RegistryKeys.Hero, c.id);
    this.registry.set(RegistryKeys.Level, 0);
    this.registry.set(RegistryKeys.Hp, 5);
    this.cameras.main.fade(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SceneKeys.Game);
    });
  }
}
