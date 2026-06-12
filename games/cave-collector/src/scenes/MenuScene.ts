import Phaser from 'phaser';
import { SceneKeys, Tex, Anim, Reg } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { buildBackground } from '../systems/background';

interface MenuData {
  won?: boolean;
  gameOver?: boolean;
  score?: number;
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(data: MenuData): void {
    buildBackground(this, GAME_WIDTH, GAME_HEIGHT);
    const cx = GAME_WIDTH / 2;

    // Mascot — the hero, idling, with a couple of floating stars.
    const hero = this.add.sprite(cx, GAME_HEIGHT / 2 - 18, Tex.Hero, 0).setScale(2);
    hero.play(Anim.HeroIdle);
    this.tweens.add({ targets: hero, y: hero.y - 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    [cx - 60, cx + 60].forEach((x, i) => {
      const s = this.add.sprite(x, GAME_HEIGHT / 2 - 30 + i * 8, Tex.Star).setScale(1.4);
      s.play(Anim.StarSpin);
      this.tweens.add({ targets: s, y: s.y - 5, duration: 800 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    let title = 'CAVE COLLECTOR';
    let titleColor = '#7df0a8';
    if (data.won) { title = 'YOU ESCAPED!'; titleColor = '#ffd23f'; }
    if (data.gameOver) { title = 'GAME OVER'; titleColor = '#ff5d9e'; }

    this.add
      .text(cx, 40, title, { fontFamily: 'monospace', fontSize: '22px', color: titleColor, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setShadow(2, 2, '#000000', 3);

    // Score / best lines for end states.
    if (data.won || data.gameOver) {
      const best = Number(localStorage.getItem(Reg.Best) || 0);
      this.add
        .text(cx, 66, `SCORE  ${data.score ?? 0}    BEST  ${best}`, { fontFamily: 'monospace', fontSize: '11px', color: '#eef6f7' })
        .setOrigin(0.5);
    } else {
      this.add
        .text(cx, 66, 'Grab the stars · dodge the bots · reach the door', { fontFamily: 'monospace', fontSize: '9px', color: '#9fe3ff' })
        .setOrigin(0.5);
    }

    const prompt = this.add
      .text(cx, GAME_HEIGHT - 36, data.won || data.gameOver ? 'PRESS / TAP TO PLAY AGAIN' : 'PRESS / TAP TO START', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const start = () => {
      this.scene.start(SceneKeys.Game, { level: 0, resetProgress: true });
    };
    this.input.once('pointerdown', start);
    this.input.keyboard?.once('keydown', start);
  }
}
