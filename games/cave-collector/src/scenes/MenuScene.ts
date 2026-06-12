import Phaser from 'phaser';
import { SceneKeys, Tex, Anim, Audio as AK } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { buildBackground } from '../systems/background';
import { AudioSystem } from '../systems/Audio';
import { Api } from '../systems/Api';
import { Storage } from '../systems/Storage';
import { showLeaderboard } from '../systems/LeaderboardPanel';
import { showNicknamePrompt } from '../systems/NicknamePrompt';
import { Icon } from '../types/keys';

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

    // ----- Title — a chunky beveled pixel "logo" (research: extrude + thick
    //   outline + gold→green gradient fill + glow; restrained era palette). Built
    //   by stacking layered text copies since we use the bitmap monospace font.
    const titleY = py + 42;
    if (data.won) {
      this.buildLogo(cx, titleY, 'YOU\nESCAPED!', '#fff3b0', '#ffb43f', 0xe08a1e);
    } else if (data.gameOver) {
      this.buildLogo(cx, titleY, 'GAME\nOVER', '#ffd0e6', '#ff6aa8', 0xb21f8a);
    } else {
      this.buildLogo(cx, titleY, 'EXPLORER\nOREO', '#ffe98a', '#7df0a8', 0x2f8f5a);
    }

    // ----- Subtitle / score line -----
    if (data.won || data.gameOver) {
      const best = Storage.getBest();
      this.add
        .text(cx, py + panelH - 26, `SCORE  ${data.score ?? 0}     BEST  ${best}`, {
          fontFamily: '"Pixelify Sans", monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffe14d',
        })
        .setOrigin(0.5).setDepth(5).setShadow(1, 1, '#000', 2);
    } else {
      this.add
        .text(cx, py + panelH - 24, '★ Grab stars   ✕ Dodge bots   ▸ Reach the door', {
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
      .text(cx, btnY, btnTxt, { fontFamily: '"Pixelify Sans", monospace', fontSize: '13px', fontStyle: 'bold', color: '#05140c' })
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
    // Pixel-art icon textures (pixelarticons, NOT emoji glyphs — §8) left of each label.
    this.addCornerButton(8, 9, Icon.Trophy, 'RANKING', '#ffe14d', 0xffe14d, () => {
      audio.play(AK.Select);
      this.overlayOpen = true;
      showLeaderboard(this, () => { this.overlayOpen = false; });
    });
    this.addCornerButton(8, 25, Icon.Edit, Storage.getNickname(), '#9fe3ff', 0x9fe3ff, () => {
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

  /** Build a chunky beveled two-line logo: pulsing glow → 3D extrude → thick
   *  outline → a two-tone gold/green fill (line 1 = top colour, line 2 = bottom).
   *  Pops in on open. (phaser-ui-ux: visual hierarchy; research: extrude+outline.) */
  private buildLogo(cx: number, cy: number, text: string, topColor: string, botColor: string, glow: number): void {
    const [l1, l2] = text.split('\n');
    const SIZE = 34, GAP = 30; // px between the two stacked lines
    const y1 = cy - GAP / 2, y2 = cy + GAP / 2;
    const style = (color: string) => ({ fontFamily: '"Pixelify Sans", monospace', fontSize: `${SIZE}px`, fontStyle: 'bold', color });
    const mk = (txt: string, x: number, y: number, color: string, depth: number) =>
      this.add.text(x, y, txt, style(color)).setOrigin(0.5).setDepth(depth);

    // soft pulsing glow behind both lines
    [[l1, y1], [l2, y2]].forEach(([t, y]) => {
      const g = mk(t as string, cx, y as number, '#000', 3).setTint(glow).setAlpha(0.45).setScale(1.08);
      this.tweens.add({ targets: g, alpha: 0.2, scale: 1.13, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    const all: Phaser.GameObjects.Text[] = [];
    const drawLine = (txt: string, y: number, fill: string) => {
      // 3D extrude: dark copies stepping down-right behind the face
      for (let d = 4; d >= 1; d--) all.push(mk(txt, cx + d, y + d, '#06140c', 4));
      // thick black outline ring (offsets ±2)
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
        if (ox === 0 && oy === 0) continue;
        all.push(mk(txt, cx + ox, y + oy, '#04100a', 5));
      }
      // bright face
      all.push(mk(txt, cx, y, fill, 6).setShadow(0, 1, '#0a3a22', 0, false, true) as Phaser.GameObjects.Text);
    };
    drawLine(l1, y1, topColor);
    drawLine(l2, y2, botColor);

    // pop-in
    all.forEach((t) => t.setScale(0.7));
    this.tweens.add({ targets: all, scale: 1, duration: 260, ease: 'Back.out' });
  }

  /** A small left-aligned button: pixel-icon texture + label; won't trigger tap-to-start. */
  private addCornerButton(
    x: number, y: number, iconKey: string, text: string, color: string, iconTint: number, onTap: () => void,
  ): void {
    // 24px icon texture displayed at 11px (integer-ish) and tinted to the label color.
    const ic = this.add.image(x + 6, y + 6, iconKey).setDisplaySize(11, 11).setDepth(100).setTint(iconTint);
    const t = this.add
      .text(x + 14, y, text, { fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold', color })
      .setOrigin(0, 0).setDepth(100).setShadow(1, 1, '#000', 2);
    const zone = this.add.zone(x, y, t.x + t.width - x + 2, 14).setOrigin(0, 0).setDepth(100).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      onTap();
    });
    void ic;
  }

  private addMuteButton(audio: AudioSystem): void {
    const x = GAME_WIDTH - 12, y = 12;
    const icon = this.add.image(x, y, audio.muted ? Icon.VolumeOff : Icon.VolumeOn)
      .setDisplaySize(13, 13).setDepth(100).setTint(0x9fe3ff);
    const zone = this.add.zone(GAME_WIDTH - 22, 2, 20, 20).setOrigin(0, 0).setDepth(100).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      // Use toggleMute's RETURN value (the new muted state) — reading audio.muted
      // back immediately is unreliable (Phaser's sound.mute getter can lag a tick).
      const nowMuted = audio.toggleMute();
      if (!nowMuted) audio.playMusic(AK.BgmMenu);
      icon.setTexture(nowMuted ? Icon.VolumeOff : Icon.VolumeOn);
    });
  }
}
