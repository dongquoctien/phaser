import Phaser from 'phaser';
import { SceneKeys, AudioKeys, Fonts, TextureKeys, mapBestKey, mapClearedKey } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { MAPS } from '../types/map';
import { MAP_BOSS, ZOMBIES, type ZombieId } from '../types/roster';
import { Storage } from '../systems/Storage';
import { drawCrown, drawLock } from '../systems/Icons';

// Map-select screen: one card per map showing name, difficulty, best wave, and a
// portrait of that map's BOSS. Maps unlock progressively — map N is playable only
// once map N-1 has been cleared (persisted in the registry). Map 0 is always open.
export class MapSelectScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.MapSelect);
  }

  // TEMP: flip to true to unlock every map for testing (no need to clear prior maps).
  private static readonly UNLOCK_ALL = false;

  private isUnlocked(index: number): boolean {
    if (MapSelectScene.UNLOCK_ALL) return true;
    if (index === 0) return true;
    return (this.registry.get(mapClearedKey(index - 1)) as boolean) ?? false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1c2c');

    this.add.text(GAME_WIDTH / 2, 36, 'SELECT MAP', {
      fontFamily: Fonts.Display, fontSize: '40px', color: '#ff3b30', stroke: '#1a1c2c', strokeThickness: 7,
    }).setOrigin(0.5);

    // CHAMPION banner — shown once every map is cleared. Read from Storage (survives a
    // reload, unlike the RAM-only registry). A pixel crown flanks the word on each side.
    const allCleared = MAPS.every((_, i) => Storage.isCleared(i));
    if (allCleared) this.drawChampionBanner();

    const cardW = GAME_WIDTH - 60;
    const cardH = 190;
    const gap = 24;
    const y0 = 110;
    const diffColor: Record<string, string> = { Easy: '#a7f070', Normal: '#ffd23f', Hard: '#ff6b6b' };

    MAPS.forEach((map, i) => {
      const cx = GAME_WIDTH / 2;
      const cy = y0 + i * (cardH + gap) + cardH / 2;
      const unlocked = this.isUnlocked(i);
      const best = (this.registry.get(mapBestKey(i)) as number) ?? 0;
      const cleared = (this.registry.get(mapClearedKey(i)) as boolean) ?? false;

      const card = this.add.rectangle(cx, cy, cardW, cardH, unlocked ? 0x241c34 : 0x18141f, 1)
        .setStrokeStyle(3, unlocked ? Phaser.Display.Color.HexStringToColor(diffColor[map.difficulty]).color : 0x3a3550);

      // boss portrait (top-left of the card) — the map's headline boss
      this.drawBossPortrait(i, cx - cardW / 2 + 16, cy - cardH / 2 + 16, 120, cardH - 32, unlocked);

      // text block (right side)
      const tx = cx - cardW / 2 + 150;
      this.add.text(tx, cy - 64, map.name, {
        fontFamily: Fonts.Display, fontSize: '26px', color: unlocked ? '#ffffff' : '#6a6480',
      });
      this.add.text(tx, cy - 36, map.difficulty, {
        fontFamily: 'monospace', fontSize: '14px', color: unlocked ? diffColor[map.difficulty] : '#6a6480',
      });
      this.add.text(tx, cy - 12, unlocked ? `Best: Wave ${best}/20` : 'Locked', {
        fontFamily: 'monospace', fontSize: '12px', color: '#8a91b4',
      });
      if (cleared) this.add.text(tx, cy + 10, '✓ CLEARED', { fontFamily: 'monospace', fontSize: '12px', color: '#a7f070' });

      if (unlocked) {
        const play = this.add.text(cx + cardW / 2 - 18, cy + cardH / 2 - 20, 'PLAY ▶', {
          fontFamily: 'monospace', fontSize: '15px', color: '#1a1c2c', backgroundColor: '#a7f070', padding: { x: 12, y: 6 },
        }).setOrigin(1, 1);
        const hit = this.add.zone(cx, cy, cardW, cardH).setInteractive({ useHandCursor: true });
        hit.name = `map:${i}`;
        hit.on('pointerup', () => {
          if (this.cache.audio.exists(AudioKeys.Click)) this.sound.play(AudioKeys.Click, { volume: 0.4 });
          this.scene.start(SceneKeys.Game, { mapIndex: i });
        });
        void play;
      } else {
        const hintY = cy + cardH / 2 - 22;
        const hint = this.add.text(cx + 8, hintY, 'Clear the previous map', {
          fontFamily: 'monospace', fontSize: '11px', color: '#8a7aa6',
        }).setOrigin(0.5);
        drawLock(this, cx - hint.width / 2 - 2, hintY, 11); // pixel lock before the text
      }
      void card;
    });

    // back to menu
    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 24, '‹ BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#8a91b4',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start(SceneKeys.Menu));
  }

  /** A small golden "CHAMPION" ribbon under the header, flanked by two pixel crowns,
   *  shown only when all maps are cleared. Pulses gently to draw the eye. */
  private drawChampionBanner(): void {
    const cx = GAME_WIDTH / 2, y = 78;
    const label = this.add.text(cx, y, 'CHAMPION', {
      fontFamily: Fonts.Display, fontSize: '22px', color: '#ffd23f', stroke: '#1a1c2c', strokeThickness: 5,
    }).setOrigin(0.5);
    const half = label.width / 2;
    const left = drawCrown(this, cx - half - 16, y, 20);
    const right = drawCrown(this, cx + half + 16, y, 20);
    this.tweens.add({ targets: [label, left, right], alpha: { from: 0.6, to: 1 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  // Render the map's headline BOSS portrait (idle frame of its sheet) in a framed
  // box. Locked maps still SHOW the boss + name but greyed out (dark tint, grey
  // name, no themed glow) so the player can preview who awaits.
  private drawBossPortrait(mapIndex: number, x: number, y: number, w: number, h: number, unlocked: boolean): void {
    const bossId = (MAP_BOSS[mapIndex] ?? 'boss') as ZombieId;
    const sheetKey: Record<string, string> = {
      boss: TextureKeys.ZombieBossStand, khoai: TextureKeys.ZombieKhoaiStand, hakj: TextureKeys.ZombieHakjStand,
    };
    const accent = unlocked ? (ZOMBIES[bossId].boss?.glow ?? 0x3a1d5a) : 0x1c1c24;
    // framed backdrop
    this.add.graphics()
      .fillStyle(0x120a1c, 1).fillRect(x, y, w, h)
      .fillStyle(accent, unlocked ? 0.55 : 0.7).fillRect(x, y, w, h)
      .lineStyle(2, unlocked ? 0xff5b5b : 0x3a3550, 0.9).strokeRect(x, y, w, h);

    // boss sprite (idle frame), fit to the box. Locked → tinted dark grey silhouette.
    const boss = this.add.image(x + w / 2, y + h / 2 + 6, sheetKey[bossId] ?? TextureKeys.ZombieBossStand, 0);
    boss.setScale(Math.min((w - 14) / boss.width, (h - 22) / boss.height));
    if (!unlocked) boss.setTint(0x444450); // grey out the locked boss

    // boss name ribbon at the bottom (grey when locked, themed colour when unlocked)
    const name = ZOMBIES[bossId].boss?.name ?? 'BOSS';
    this.add.text(x + w / 2, y + h - 10, name.toUpperCase(), {
      fontFamily: Fonts.Zombie, fontSize: '15px',
      color: unlocked ? (ZOMBIES[bossId].boss?.fill ?? '#ff6b6b') : '#7a7a88',
      stroke: '#1a1c2c', strokeThickness: 3, align: 'center', wordWrap: { width: w - 6 },
    }).setOrigin(0.5, 1);

    // a small pixel lock badge top-right so it still reads as locked (no emoji)
    if (!unlocked) {
      drawLock(this, x + w - 11, y + 11, 15);
    }
  }
}
