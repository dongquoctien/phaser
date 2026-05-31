import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { rollChoices, type Skill } from '../types/skills';

interface LevelUpData {
  taken: Record<string, number>;
  gameKey: string;
}

const RARITY_COLOR: Record<string, number> = {
  common: 0x94b0c2,
  rare: 0x41a6f6,
  epic: 0xa855f7,
};

// Overlay scene launched on top of a PAUSED GameScene. Shows 3 skill cards; on
// pick it emits 'skillPicked' back to GameScene, resumes it, and stops itself.
export class LevelUpScene extends Phaser.Scene {
  private gameKey: string = SceneKeys.Game;

  constructor() {
    super(SceneKeys.LevelUp);
  }

  create(data: LevelUpData): void {
    this.gameKey = data.gameKey ?? SceneKeys.Game;
    const choices = rollChoices(data.taken ?? {}, 3);

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.78)
      .setOrigin(0, 0)
      .setDepth(0);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.16, 'LEVEL UP!', {
        fontFamily: 'monospace', fontSize: '34px', color: '#a7f070',
        stroke: '#1a1c2c', strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.23, 'Choose a skill', {
        fontFamily: 'monospace', fontSize: '14px', color: '#e8ecff',
      })
      .setOrigin(0.5);

    const cardW = GAME_WIDTH - 80;
    const cardH = 110;
    const gap = 18;
    const startY = GAME_HEIGHT * 0.3;
    choices.forEach((sk, i) => this.makeCard(sk, GAME_WIDTH / 2, startY + i * (cardH + gap), cardW, cardH));

    if (choices.length === 0) {
      // Nothing left to learn — just resume.
      this.pick(null);
    }
  }

  private makeCard(skill: Skill, cx: number, cy: number, w: number, h: number): void {
    const c = this.add.container(cx, cy);
    const color = RARITY_COLOR[skill.rarity] ?? 0x94b0c2;
    const gutter = 56; // left zone holding the skill icon
    const textX = -w / 2 + gutter; // name/desc start right of the gutter
    const bg = this.add
      .rectangle(0, 0, w, h, 0x161a2b)
      .setStrokeStyle(3, color)
      .setOrigin(0.5);
    // Icon framed in the left gutter (baked 9x9 px=3 → 27px; scale up to read).
    const iconBg = this.add
      .rectangle(-w / 2 + gutter / 2, 0, 40, 40, 0x0e1120)
      .setStrokeStyle(1, color, 0.6)
      .setOrigin(0.5);
    const icon = this.add
      .image(-w / 2 + gutter / 2, 0, skill.icon)
      .setOrigin(0.5)
      .setScale(1.3);
    const name = this.add
      .text(textX, -h / 2 + 14, skill.name, {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      })
      .setOrigin(0, 0);
    const rarity = this.add
      .text(w / 2 - 16, -h / 2 + 16, skill.rarity.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '10px',
        color: '#' + color.toString(16).padStart(6, '0'),
      })
      .setOrigin(1, 0);
    const desc = this.add
      .text(textX, 6, skill.desc, {
        fontFamily: 'monospace', fontSize: '14px', color: '#8a91b4',
        wordWrap: { width: w - gutter - 32 },
      })
      .setOrigin(0, 0);
    c.add([bg, iconBg, icon, name, rarity, desc]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerup', () => this.pick(skill));
  }

  private pick(skill: Skill | null): void {
    const game = this.scene.get(this.gameKey);
    if (skill) game.events.emit('skillPicked', skill);
    this.scene.resume(this.gameKey);
    this.scene.stop();
  }
}
