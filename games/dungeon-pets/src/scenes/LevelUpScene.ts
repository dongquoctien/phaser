import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { rollChoices, type Skill } from '../types/skills';

interface LevelUpData {
  taken: Record<string, number>;
  gameKey: string;
}

const RARITY_COLOR: Record<string, number> = {
  common: 0x94b0c2, rare: 0x41a6f6, epic: 0xc06af0,
};

// Overlay launched over a PAUSED GameScene. Shows 3 skill cards; on pick it
// emits 'skillPicked' back, resumes the game, and stops itself.
export class LevelUpScene extends Phaser.Scene {
  private gameKey: string = SceneKeys.Game;

  constructor() {
    super(SceneKeys.LevelUp);
  }

  create(data: LevelUpData): void {
    this.gameKey = data.gameKey ?? SceneKeys.Game;
    const choices = rollChoices(data.taken ?? {}, 3);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.78).setOrigin(0).setDepth(0);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.16, 'LEVEL UP!', {
      fontFamily: 'monospace', fontSize: '34px', color: '#7cf59b', stroke: '#1a1020', strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.23, 'Learn a skill', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8dcff',
    }).setOrigin(0.5);

    const cardW = GAME_WIDTH - 80;
    const cardH = 110;
    const gap = 18;
    const startY = GAME_HEIGHT * 0.3;
    choices.forEach((sk, i) => {
      const c = this.makeCard(sk, GAME_WIDTH / 2, startY + i * (cardH + gap), cardW, cardH);
      // §3 anticipation pop — cards spring in, staggered, with Back.easeOut.
      c.setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: c, scale: 1, alpha: 1, delay: i * 70, duration: 260, ease: 'Back.easeOut' });
    });

    if (choices.length === 0) this.pick(null);
  }

  private makeCard(skill: Skill, cx: number, cy: number, w: number, h: number): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy);
    const color = RARITY_COLOR[skill.rarity] ?? 0x94b0c2;
    const gutter = 64;
    const textX = -w / 2 + gutter + 4;
    const bg = this.add.rectangle(0, 0, w, h, 0x2c2140).setStrokeStyle(3, color).setOrigin(0.5);
    const iconBg = this.add.rectangle(-w / 2 + gutter / 2, 0, 46, 46, 0x1a1020).setStrokeStyle(1, color, 0.7);
    const icon = this.add.text(-w / 2 + gutter / 2, 0, skill.icon, {
      fontFamily: 'monospace', fontSize: '15px', color: '#ffffff', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    const name = this.add.text(textX, -h / 2 + 14, skill.name, {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0);
    const rarity = this.add.text(w / 2 - 16, -h / 2 + 16, skill.rarity.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '10px', color: '#' + color.toString(16).padStart(6, '0'),
    }).setOrigin(1, 0);
    const desc = this.add.text(textX, 6, skill.desc, {
      fontFamily: 'monospace', fontSize: '14px', color: '#cdbce6', wordWrap: { width: w - gutter - 28 },
    }).setOrigin(0, 0);
    c.add([bg, iconBg, icon, name, rarity, desc]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerup', () => this.pick(skill));
    return c;
  }

  private pick(skill: Skill | null): void {
    const game = this.scene.get(this.gameKey);
    if (skill) game.events.emit('skillPicked', skill);
    this.scene.resume(this.gameKey);
    this.scene.stop();
  }
}
