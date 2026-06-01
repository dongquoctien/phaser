import Phaser from 'phaser';
import { SceneKeys, AudioKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { STARTERS } from '../types/roster';

// Pick ONE hero (each plays differently), then start the run. Pets join later.
export class MenuScene extends Phaser.Scene {
  private chosen: string | null = null;
  private cards: Phaser.GameObjects.Container[] = [];
  private blurb!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.chosen = null;
    this.cards = [];
    this.cameras.main.setBackgroundColor('#20162e');

    this.add.text(GAME_WIDTH / 2, 70, 'DUNGEON PETS', {
      fontFamily: 'monospace', fontSize: '40px', color: '#ffffff', stroke: '#1a1020', strokeThickness: 7,
    }).setOrigin(0.5);

    const best = (this.registry.get(RegistryKeys.BestFloor) as number) ?? 0;
    this.add.text(GAME_WIDTH / 2, 116, `BEST: Floor ${best}`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd23f',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 160, 'Choose your hero', {
      fontFamily: 'monospace', fontSize: '16px', color: '#cdbce6',
    }).setOrigin(0.5);

    STARTERS.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_WIDTH / 2 + (col === 0 ? -100 : 100);
      const y = 230 + row * 140;
      this.cards.push(this.makeCard(def.id, def.texture, def.name, def.blurb, x, y));
    });

    this.blurb = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 150, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#a7f070', align: 'center',
    }).setOrigin(0.5);

    this.startBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'PICK A HERO', {
      fontFamily: 'monospace', fontSize: '24px', color: '#9aa0b0', stroke: '#1a1020', strokeThickness: 5,
      backgroundColor: '#2c2140', padding: { x: 28, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.startBtn.on('pointerup', () => this.tryStart());

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 44, 'Auto-fire · stack attack skills that combo · a pet joins every 5 floors', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8a7aa6', align: 'center', wordWrap: { width: GAME_WIDTH - 40 },
    }).setOrigin(0.5);
  }

  private makeCard(id: string, texture: string, name: string, blurb: string, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 150, 116, 0x3a2f55).setStrokeStyle(3, 0x4a3a6a);
    const img = this.add.image(0, -14, texture).setScale(0.9);
    const label = this.add.text(0, 40, name, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    c.add([bg, img, label]);
    c.setData('id', id); c.setData('bg', bg); c.setData('blurb', blurb);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.choose(id));
    return c;
  }

  private choose(id: string): void {
    if (this.cache.audio.exists(AudioKeys.Click)) this.sound.play(AudioKeys.Click, { volume: 0.4 });
    this.chosen = id;
    for (const c of this.cards) {
      const on = c.getData('id') === id;
      const bg = c.getData('bg') as Phaser.GameObjects.Rectangle;
      bg.setStrokeStyle(3, on ? 0x7cf59b : 0x4a3a6a);
      bg.setFillStyle(on ? 0x46406a : 0x3a2f55);
      c.setScale(on ? 1.06 : 1);
      if (on) this.blurb.setText(c.getData('blurb') as string);
    }
    this.startBtn.setColor('#a7f070').setText('START');
  }

  private tryStart(): void {
    if (!this.chosen) return;
    if (this.cache.audio.exists(AudioKeys.Click)) this.sound.play(AudioKeys.Click, { volume: 0.5 });
    this.registry.set(RegistryKeys.Team, this.chosen);
    this.scene.start(SceneKeys.Game, { hero: this.chosen });
  }
}
