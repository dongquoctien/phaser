import Phaser from 'phaser';
import { SceneKeys, AudioKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';
import { STARTERS } from '../types/roster';

// Pick a team of Tuning.teamSize starter heroes, then start the run.
export class MenuScene extends Phaser.Scene {
  private chosen = new Set<string>();
  private cards: Phaser.GameObjects.Container[] = [];
  private startBtn!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.chosen = new Set();
    this.cards = [];
    this.cameras.main.setBackgroundColor('#20162e');

    this.add.text(GAME_WIDTH / 2, 70, 'DUNGEON PETS', {
      fontFamily: 'monospace', fontSize: '40px', color: '#ffffff', stroke: '#1a1020', strokeThickness: 7,
    }).setOrigin(0.5);

    const best = (this.registry.get(RegistryKeys.BestFloor) as number) ?? 0;
    this.add.text(GAME_WIDTH / 2, 116, `BEST: Floor ${best}`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd23f',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 160, `Choose ${Tuning.teamSize} heroes`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#cdbce6',
    }).setOrigin(0.5);

    // roster grid (2 cols)
    STARTERS.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_WIDTH / 2 + (col === 0 ? -100 : 100);
      const y = 230 + row * 130;
      this.cards.push(this.makeCard(def.id, def.texture, def.name, x, y));
    });

    this.startBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 90, 'START', {
      fontFamily: 'monospace', fontSize: '26px', color: '#9aa0b0', stroke: '#1a1020', strokeThickness: 5,
      backgroundColor: '#2c2140', padding: { x: 30, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.startBtn.on('pointerup', () => this.tryStart());

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, 'Auto-battle · pick skills on level-up · a pet joins every 5 floors', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8a7aa6', align: 'center', wordWrap: { width: GAME_WIDTH - 40 },
    }).setOrigin(0.5);

    this.refresh();
  }

  private makeCard(id: string, texture: string, name: string, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 150, 110, 0x3a2f55).setStrokeStyle(3, 0x4a3a6a);
    const img = this.add.image(0, -12, texture).setScale(0.9);
    const label = this.add.text(0, 38, name, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);
    c.add([bg, img, label]);
    c.setData('id', id);
    c.setData('bg', bg);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggle(id));
    return c;
  }

  private toggle(id: string): void {
    if (this.cache.audio.exists(AudioKeys.Click)) this.sound.play(AudioKeys.Click, { volume: 0.4 });
    if (this.chosen.has(id)) this.chosen.delete(id);
    else if (this.chosen.size < Tuning.teamSize) this.chosen.add(id);
    this.refresh();
  }

  private refresh(): void {
    for (const c of this.cards) {
      const id = c.getData('id') as string;
      const bg = c.getData('bg') as Phaser.GameObjects.Rectangle;
      const on = this.chosen.has(id);
      bg.setStrokeStyle(3, on ? 0x7cf59b : 0x4a3a6a);
      bg.setFillStyle(on ? 0x46406a : 0x3a2f55);
      c.setScale(on ? 1.05 : 1);
    }
    const ready = this.chosen.size === Tuning.teamSize;
    this.startBtn.setColor(ready ? '#a7f070' : '#9aa0b0');
    this.startBtn.setText(ready ? 'START' : `PICK ${Tuning.teamSize - this.chosen.size} MORE`);
  }

  private tryStart(): void {
    if (this.chosen.size !== Tuning.teamSize) return;
    if (this.cache.audio.exists(AudioKeys.Click)) this.sound.play(AudioKeys.Click, { volume: 0.5 });
    const team = [...this.chosen];
    this.registry.set(RegistryKeys.Team, team);
    this.scene.start(SceneKeys.Game, { team });
  }
}
