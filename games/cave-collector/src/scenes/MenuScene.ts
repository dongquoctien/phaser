import Phaser from 'phaser';
import { SceneKeys, Tex, Anim, Audio as AK } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { buildBackground } from '../systems/background';
import { AudioSystem } from '../systems/Audio';
import { Api } from '../systems/Api';
import { Storage } from '../systems/Storage';
import { showLeaderboard } from '../systems/LeaderboardPanel';
import { showNicknamePrompt } from '../systems/NicknamePrompt';

interface MenuData {
  won?: boolean;
  gameOver?: boolean;
  score?: number;
}

export class MenuScene extends Phaser.Scene {
  // True while ANY modal (nickname prompt / leaderboard) is open. The scene-level
  // tap/key "start" handler checks this FIRST — Phaser fires scene input for every
  // pointer regardless of overlays on top, and stopPropagation on a child object
  // does NOT reach a scene-level handler. This flag is the real click-through fix
  // (phaser-ui-ux §1).
  private overlayOpen = false;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(data: MenuData): void {
    this.overlayOpen = false;
    buildBackground(this, GAME_WIDTH, GAME_HEIGHT);
    const cx = GAME_WIDTH / 2;
    const audio = new AudioSystem(this);
    audio.playMusic(AK.BgmMenu);

    // Dark vignette at the edges so the centre reads clearly over the busy cave.
    const vig = this.add.graphics().setDepth(1);
    vig.fillStyle(0x05090b, 0.45);
    vig.fillRect(0, 0, GAME_WIDTH, 26);
    vig.fillRect(0, GAME_HEIGHT - 30, GAME_WIDTH, 30);

    // Centre panel behind the text block (semi-transparent, rounded, glowing edge).
    const panelW = 300;
    const panelH = 128;
    const px = cx - panelW / 2;
    const py = 20;
    const panel = this.add.graphics().setDepth(2);
    panel.fillStyle(0x0a1820, 0.62).fillRoundedRect(px, py, panelW, panelH, 8);
    panel.lineStyle(2, 0x2f8f5a, 0.9).strokeRoundedRect(px, py, panelW, panelH, 8);
    panel.lineStyle(1, 0x7df0a8, 0.5).strokeRoundedRect(px + 2, py + 2, panelW - 4, panelH - 4, 7);

    // ----- Title (chunky pixel outline + glow, themed to the state) -----
    let title = 'EXPLORER\nOREO';
    let titleColor = '#8bf6b0';
    let glow = 0x2f8f5a;
    if (data.won) { title = 'YOU\nESCAPED!'; titleColor = '#ffe14d'; glow = 0xe08a1e; }
    if (data.gameOver) { title = 'GAME\nOVER'; titleColor = '#ff7db0'; glow = 0xb21f8a; }

    const titleY = py + 40;
    // soft glow: a blurred-ish duplicate drawn larger + tinted, behind
    const glowText = this.add
      .text(cx, titleY, title, {
        fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold',
        color: '#000000', align: 'center', lineSpacing: -4,
      })
      .setOrigin(0.5).setDepth(3).setTint(glow).setAlpha(0.5).setScale(1.06);
    this.tweens.add({ targets: glowText, alpha: 0.25, scale: 1.1, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // hard outline: 8 black copies offset 1px around, then the colored top.
    const mkTitle = (color: string, ox: number, oy: number, depth: number) =>
      this.add
        .text(cx + ox, titleY + oy, title, {
          fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold',
          color, align: 'center', lineSpacing: -4,
        })
        .setOrigin(0.5).setDepth(depth);
    for (let oy = -2; oy <= 2; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        if (ox === 0 && oy === 0) continue;
        mkTitle('#05140c', ox, oy, 4);
      }
    }
    mkTitle(titleColor, 0, 0, 5).setShadow(0, 2, '#0a3a22', 0, false, true);

    // ----- Subtitle / score line -----
    if (data.won || data.gameOver) {
      const best = Storage.getBest();
      this.add
        .text(cx, py + panelH - 26, `SCORE  ${data.score ?? 0}     BEST  ${best}`, {
          fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffe14d',
        })
        .setOrigin(0.5).setDepth(5).setShadow(1, 1, '#000', 2);
    } else {
      this.add
        .text(cx, py + panelH - 24, '★ Grab stars   ✦ Dodge bots   ▸ Reach the door', {
          fontFamily: 'monospace', fontSize: '9px', color: '#9fe3ff',
        })
        .setOrigin(0.5).setDepth(5).setShadow(1, 1, '#000', 2);
    }

    // ----- Hero mascot + orbiting stars (in the gap below the panel) -----
    const mascotY = GAME_HEIGHT - 34; // feet just above the Start button
    const hero = this.add.sprite(cx, mascotY, Tex.Hero, 0).setDepth(5).setScale(1.3).setOrigin(0.5, 1);
    hero.play(Anim.HeroIdle);
    this.tweens.add({ targets: hero, y: mascotY - 4, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    [[-42, -14, 1.1], [42, -18, 0.95]].forEach(([dx, dy, sc], i) => {
      const s = this.add.sprite(cx + dx, mascotY + dy, Tex.Star).setDepth(4).setScale(sc as number);
      s.play(Anim.StarSpin);
      this.tweens.add({ targets: s, y: s.y - 5, duration: 900 + i * 220, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    // ----- Start button (framed, pulsing) -----
    const btnY = GAME_HEIGHT - 14;
    const btnTxt = data.won || data.gameOver ? 'TAP TO PLAY AGAIN' : 'TAP / PRESS TO START';
    const label = this.add
      .text(cx, btnY, btnTxt, { fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#05140c' })
      .setOrigin(0.5).setDepth(6);
    const bw = label.width + 24;
    const bh = 20;
    const btn = this.add.graphics().setDepth(5);
    btn.fillStyle(0x7df0a8, 1).fillRoundedRect(cx - bw / 2, btnY - bh / 2, bw, bh, 5);
    btn.lineStyle(2, 0x2f8f5a, 1).strokeRoundedRect(cx - bw / 2, btnY - bh / 2, bw, bh, 5);
    label.setDepth(6); // keep label above the button fill
    this.tweens.add({ targets: [btn, label], alpha: 0.55, duration: 650, yoyo: true, repeat: -1 });

    this.addMuteButton(audio);

    // ----- input -----
    let started = false;
    const start = () => {
      if (started || this.overlayOpen) return; // ← swallow taps/keys while a modal is up
      started = true;
      audio.play(AK.Select);
      audio.stopMusic();
      this.scene.start(SceneKeys.Game, { level: 0, resetProgress: true });
    };

    // Corner buttons. They flip overlayOpen so the scene-level `start` can't fire
    // for taps that land on the open modal (stopPropagation alone won't do it).
    this.addCornerButton(8, 8, '☰ RANKING', '#ffe14d', () => {
      audio.play(AK.Select);
      this.overlayOpen = true;
      showLeaderboard(this, () => { this.overlayOpen = false; });
    });
    this.addCornerButton(8, 24, '✎ ' + Storage.getNickname(), '#9fe3ff', () => {
      audio.play(AK.Select);
      this.overlayOpen = true;
      showNicknamePrompt(this, { onDone: () => this.scene.restart(data) });
    });

    this.input.keyboard?.on('keydown', start);
    this.input.on('pointerdown', start);

    // First-ever launch: ask for a name once (non-blocking; cancel = random).
    if (!Storage.hasNickname() && Api.enabled && !data.won && !data.gameOver) {
      this.overlayOpen = true;
      this.time.delayedCall(200, () => showNicknamePrompt(this, { force: true, onDone: () => this.scene.restart(data) }));
    }
  }

  /** A small left-aligned text button that won't trigger the scene's tap-to-start. */
  private addCornerButton(x: number, y: number, text: string, color: string, onTap: () => void): void {
    const t = this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold', color })
      .setOrigin(0, 0).setDepth(100).setShadow(1, 1, '#000', 2)
      .setInteractive({ useHandCursor: true });
    t.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      onTap();
    });
  }

  private addMuteButton(audio: AudioSystem): void {
    const label = () => (audio.muted ? '♪✕' : '♪');
    const txt = this.add
      .text(GAME_WIDTH - 8, 8, label(), { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#9fe3ff' })
      .setOrigin(1, 0)
      .setDepth(100)
      .setShadow(1, 1, '#000', 2)
      .setInteractive({ useHandCursor: true });
    txt.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      audio.toggleMute();
      if (!audio.muted) audio.playMusic(AK.BgmMenu);
      txt.setText(label());
    });
  }
}
