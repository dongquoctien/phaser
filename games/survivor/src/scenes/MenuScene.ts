import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import {
  DIFFICULTIES,
  DIFFICULTY_COLOR,
  type Difficulty,
} from '../types/difficulty';

export class MenuScene extends Phaser.Scene {
  private diff: Difficulty = 'normal';
  private diffButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.diff =
      (this.registry.get(RegistryKeys.Difficulty) as Difficulty) ?? 'normal';

    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT * 0.24, TextureKeys.Hero)
      .setScale(2.4);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.38, 'SURVIVOR', {
        fontFamily: 'monospace', fontSize: '44px', color: '#ffffff',
        stroke: '#1a1c2c', strokeThickness: 6,
      })
      .setOrigin(0.5);

    const best = (this.registry.get(RegistryKeys.BestTime) as number) ?? 0;
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.46, `BEST: ${formatTime(best)}`, {
        fontFamily: 'monospace', fontSize: '16px', color: '#73eff7',
      })
      .setOrigin(0.5);

    // Difficulty selector
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.56, 'DIFFICULTY', {
        fontFamily: 'monospace', fontSize: '12px', color: '#8a91b4',
      })
      .setOrigin(0.5);
    this.diffButtons = DIFFICULTIES.map((d, i) => {
      const x = GAME_WIDTH * (0.25 + i * 0.25);
      const btn = this.add
        .text(x, GAME_HEIGHT * 0.61, d.toUpperCase(), {
          fontFamily: 'monospace', fontSize: '15px', color: '#ffffff',
          stroke: '#1a1c2c', strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.setData('diff', d);
      btn.on('pointerup', () => this.selectDiff(d));
      return btn;
    });
    this.refreshDiffButtons();

    // Start prompt — an explicit interactive target (NOT a global pointerdown,
    // so tapping a difficulty button doesn't also start the game).
    const startBtn = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.74, 'START', {
        fontFamily: 'monospace', fontSize: '26px', color: '#a7f070',
        stroke: '#1a1c2c', strokeThickness: 5,
        backgroundColor: '#1b2138', padding: { x: 26, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: startBtn, alpha: 0.55, duration: 650, yoyo: true, repeat: -1 });
    startBtn.on('pointerup', () => this.start());
    this.input.keyboard?.once('keydown-SPACE', () => this.start());

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 18, 'Move: joystick / WASD · auto-fire', {
        fontFamily: 'monospace', fontSize: '11px', color: '#8a91b4',
      })
      .setOrigin(0.5);
  }

  private selectDiff(d: Difficulty): void {
    this.diff = d;
    this.registry.set(RegistryKeys.Difficulty, d);
    if (this.cache.audio.exists(AudioKeys.Click)) {
      this.sound.play(AudioKeys.Click, { volume: 0.4 });
    }
    this.refreshDiffButtons();
  }

  private refreshDiffButtons(): void {
    for (const btn of this.diffButtons) {
      const d = btn.getData('diff') as Difficulty;
      const on = d === this.diff;
      btn.setColor(on ? DIFFICULTY_COLOR[d] : '#566c86');
      btn.setScale(on ? 1.15 : 1);
    }
  }

  private start(): void {
    if (this.cache.audio.exists(AudioKeys.Click)) {
      this.sound.play(AudioKeys.Click, { volume: 0.5 });
    }
    this.scene.start(SceneKeys.Game, { difficulty: this.diff });
  }
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
