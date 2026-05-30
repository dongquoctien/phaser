import Phaser from 'phaser';
import {
  SWEETIE16 as C,
  lit,
  shade,
  bakeSprite,
  BUILTINS,
  type PixelGrid,
} from '../../../src/pixel';
import { HUB_WIDTH, HUB_HEIGHT } from '../config';
import { GAMES, type HubGame } from '../games.generated';

const FONT = '"Press Start 2P"';

export class HubScene extends Phaser.Scene {
  private cards: Phaser.GameObjects.Container[] = [];
  private selected = 0;
  private cols = 1;

  constructor() {
    super('HubScene');
  }

  create(): void {
    this.drawHeader();
    this.layoutCards();
    this.setupKeyboard();
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  private drawHeader(): void {
    const { key, width: gw } = bakeSprite(this, 'glyph:gamepad', BUILTINS.gamepad, {
      px: 3,
    });
    const titleX = HUB_WIDTH / 2;

    const icon = this.add.image(0, 40, key).setOrigin(0.5);
    const title = this.add
      .text(0, 40, 'PHASER ARCADE', {
        fontFamily: FONT,
        fontSize: '24px',
        color: hex(C.skyblue),
      })
      .setOrigin(0, 0.5);

    // Center the icon+title group as a unit.
    const gap = 16;
    const totalW = gw + gap + title.width;
    icon.setX(titleX - totalW / 2 + gw / 2);
    title.setX(titleX - totalW / 2 + gw + gap);

    const n = GAMES.length;
    this.add
      .text(titleX, 78, `${n} GAME${n === 1 ? '' : 'S'}  -  CLICK TO PLAY`, {
        fontFamily: FONT,
        fontSize: '8px',
        color: hex(C.grey),
      })
      .setOrigin(0.5);
  }

  // ── Card grid ──────────────────────────────────────────────────────────────
  private layoutCards(): void {
    const cardW = 220;
    const cardH = 176;
    const gapX = 24;
    const gapY = 24;
    // How many columns fit, capped at the number of games (don't reserve empty
    // columns when there are only a few games — keeps the grid centered).
    const fit = Phaser.Math.Clamp(Math.floor((HUB_WIDTH - 80) / (cardW + gapX)), 1, 4);
    const cols = Math.min(fit, GAMES.length || 1);
    this.cols = cols;
    const rows = Math.ceil(GAMES.length / cols);

    const gridW = cols * cardW + (cols - 1) * gapX;
    const gridH = rows * cardH + (rows - 1) * gapY;
    const startX = Math.round((HUB_WIDTH - gridW) / 2);
    // Center the grid in the area below the header.
    const headerBottom = 140;
    const startY = Math.round(headerBottom + (HUB_HEIGHT - headerBottom - gridH) / 2);

    GAMES.forEach((game, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      this.cards.push(this.makeCard(game, i, x, y, cardW, cardH));
    });

    this.highlight(0);
  }

  private makeCard(
    game: HubGame,
    index: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Pixel bevel frame: raised button look, single light direction (top-left).
    const frame = this.add.graphics();
    this.drawBevel(frame, 0, 0, w, h, C.dark, false);
    container.add(frame);
    container.setData('frame', frame);
    container.setData('size', { w, h });

    // Thumbnail (baked from the game's grid, or the cabinet default).
    const grid: PixelGrid = game.thumb ?? BUILTINS.cabinet;
    const thumbBoxX = 10;
    const thumbBoxY = 10;
    const thumbBoxW = w - 20;
    const thumbBoxH = 110;
    // Inset well behind the thumb.
    const well = this.add.graphics();
    this.drawBevel(well, thumbBoxX, thumbBoxY, thumbBoxW, thumbBoxH, C.black, true);
    container.add(well);

    const { key, width: aw, height: ah } = bakeSprite(this, `thumb:${game.name}`, grid, {
      px: 1,
    });
    const scale = Math.max(
      1,
      Math.floor(Math.min((thumbBoxW - 12) / aw, (thumbBoxH - 12) / ah)),
    );
    const thumb = this.add
      .image(thumbBoxX + thumbBoxW / 2, thumbBoxY + thumbBoxH / 2, key)
      .setOrigin(0.5)
      .setScale(scale);
    container.add(thumb);

    // Play glyph in the thumbnail corner.
    const { key: playKey } = bakeSprite(this, 'glyph:play', BUILTINS.play, { px: 2 });
    const play = this.add
      .image(thumbBoxX + thumbBoxW - 12, thumbBoxY + thumbBoxH - 12, playKey)
      .setOrigin(1, 1);
    container.add(play);

    // Title.
    const title = this.add.text(12, thumbBoxY + thumbBoxH + 12, truncate(game.title, 16), {
      fontFamily: FONT,
      fontSize: '10px',
      color: hex(C.white),
    });
    container.add(title);

    // Tag chips.
    let chipX = 12;
    const chipY = thumbBoxY + thumbBoxH + 36;
    game.tags.slice(0, 3).forEach((tag) => {
      const label = tag.toUpperCase();
      const tw = label.length * 6 + 12;
      const chip = this.add.graphics();
      chip.fillStyle(C.darkblue, 1).fillRect(chipX, chipY, tw, 16);
      chip.lineStyle(1, C.blue, 1).strokeRect(chipX + 0.5, chipY + 0.5, tw - 1, 16 - 1);
      container.add(chip);
      const t = this.add
        .text(chipX + tw / 2, chipY + 8, label, {
          fontFamily: FONT,
          fontSize: '6px',
          color: hex(C.skyblue),
        })
        .setOrigin(0.5);
      container.add(t);
      chipX += tw + 6;
    });

    // Whole-card hit area (Fitt's law).
    const zone = this.add
      .zone(0, 0, w, h)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    container.add(zone);
    zone.on('pointerover', () => this.highlight(index));
    zone.on('pointerup', () => this.navigate(game));

    return container;
  }

  /** Draw a hard-edged pixel bevel. raised=false → button out; inset=true → pressed in. */
  private drawBevel(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    base: number,
    inset: boolean,
  ): void {
    const light = lit(base, 1.4);
    const dark = shade(base, 1.4);
    const top = inset ? dark : light;
    const bottom = inset ? light : dark;
    g.fillStyle(base, 1).fillRect(x, y, w, h);
    // top + left edge
    g.fillStyle(top, 1).fillRect(x, y, w, 2).fillRect(x, y, 2, h);
    // bottom + right edge
    g.fillStyle(bottom, 1)
      .fillRect(x, y + h - 2, w, 2)
      .fillRect(x + w - 2, y, 2, h);
  }

  // ── Selection / focus ───────────────────────────────────────────────────────
  private highlight(index: number): void {
    if (!this.cards.length) return;
    this.selected = Phaser.Math.Clamp(index, 0, this.cards.length - 1);
    this.cards.forEach((card, i) => {
      const frame = card.getData('frame') as Phaser.GameObjects.Graphics;
      const { w, h } = card.getData('size') as { w: number; h: number };
      frame.clear();
      const focused = i === this.selected;
      this.drawBevel(frame, 0, 0, w, h, focused ? C.slate : C.dark, false);
      if (focused) {
        // chunky pixel focus ring
        frame.lineStyle(2, C.skyblue, 1).strokeRect(1, 1, w - 2, h - 2);
      }
      card.setY(card.y); // no-op keep
    });
  }

  private setupKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-RIGHT', () => this.highlight(this.selected + 1));
    kb.on('keydown-LEFT', () => this.highlight(this.selected - 1));
    kb.on('keydown-DOWN', () => this.highlight(this.selected + this.cols));
    kb.on('keydown-UP', () => this.highlight(this.selected - this.cols));
    const go = () => {
      const g = GAMES[this.selected];
      if (g) this.navigate(g);
    };
    kb.on('keydown-ENTER', go);
    kb.on('keydown-SPACE', go);
  }

  private navigate(game: HubGame): void {
    window.location.href = game.href;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────
function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
