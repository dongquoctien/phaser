import Phaser from 'phaser';
import { SceneKeys, AudioKeys, RegistryKeys, TextureKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, CELL, GRID_COLS, GRID_ROWS, FIELD_H, HUD_TOP, Tuning } from '../config';
import { Enemy } from '../objects/Enemy';
import { Bullet } from '../objects/Bullet';
import { Tower } from '../objects/Tower';
import { Audio } from '../systems/Audio';
import { TOWERS, TOWER_IDS, ENEMIES, type TowerId, type EnemyId } from '../types/roster';
import { PATH_CELLS, DECOR, blockedCells, pathWaypoints, cellCenter, isInsideGrid } from '../types/map';

declare const __DEV__: boolean;

export class GameScene extends Phaser.Scene {
  private audio!: Audio;
  private enemies: Enemy[] = [];
  private bullets!: Phaser.GameObjects.Group;
  private towers: Tower[] = [];
  private blocked = new Set<string>();
  private occupied = new Set<string>(); // cells with a tower
  private waypoints: { x: number; y: number }[] = [];

  private money = 0;
  private lives = 0;
  private wave = 0;
  private waveActive = false;
  private spawnQueue: EnemyId[] = [];
  private nextSpawnAt = 0;
  private over = false;

  // UI
  private moneyText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Text;
  private rangePreview!: Phaser.GameObjects.Arc;
  private buildId: TowerId | null = null; // currently selected tower-to-build
  private selectedTower: Tower | null = null;
  private shopButtons: Phaser.GameObjects.Container[] = [];
  private upgradePanel!: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.enemies = [];
    this.towers = [];
    this.occupied = new Set();
    this.blocked = blockedCells();
    this.waypoints = pathWaypoints();
    this.money = Tuning.startMoney;
    this.lives = Tuning.startLives;
    this.wave = 0;
    this.waveActive = false;
    this.spawnQueue = [];
    this.over = false;
    this.buildId = null;
    this.selectedTower = null;

    this.audio = new Audio(this);
    this.drawMap();

    this.bullets = this.add.group({ classType: Bullet, maxSize: Tuning.poolBullets });
    for (let i = 0; i < Tuning.poolBullets; i++) this.bullets.add(new Bullet(this), true);
    this.bullets.getChildren().forEach((b) => (b as Bullet).despawn());
    for (let i = 0; i < Tuning.poolEnemies; i++) {
      const e = new Enemy(this);
      this.add.existing(e);
      this.enemies.push(e);
    }

    this.rangePreview = this.add.circle(0, 0, 100, 0x7cf59b, 0.12).setStrokeStyle(2, 0x7cf59b, 0.5).setDepth(20).setVisible(false);
    this.buildHud();
    this.buildShop();
    this.buildUpgradePanel();

    // Tap the field to place / select.
    this.input.on('pointerdown', this.onFieldTap, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', this.onFieldTap, this));

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      (this as unknown as Record<string, unknown>).__dev = {
        state: () => ({ wave: this.wave, money: this.money, lives: this.lives, towers: this.towers.length, enemies: this.enemies.filter((e) => !e.dead).length, over: this.over }),
        money: (n: number) => { this.money = n; this.refreshHud(); },
        place: (id: TowerId, col: number, row: number) => this.placeTower(id, col, row),
        startWave: () => this.startWave(),
      };
    }
  }

  // ── map ─────────────────────────────────────────────────────────────────────
  private drawMap(): void {
    // grass everywhere, then path tiles, then decor
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const { x, y } = cellCenter(c, r);
        this.add.image(x, y, TextureKeys.Grass).setDepth(0);
      }
    }
    for (const [c, r] of PATH_CELLS) {
      if (!isInsideGrid(c, r)) continue;
      const { x, y } = cellCenter(c, r);
      this.add.image(x, y, TextureKeys.Path).setDepth(1);
    }
    for (const d of DECOR) {
      if (!isInsideGrid(d.cell[0], d.cell[1])) continue;
      const { x, y } = cellCenter(d.cell[0], d.cell[1]);
      this.add.image(x, y, d.kind === 'tree' ? TextureKeys.Tree : TextureKeys.Barrel).setDepth(4);
    }
    // HUD strip background
    this.add.rectangle(0, HUD_TOP, GAME_WIDTH, GAME_HEIGHT - HUD_TOP, 0x141019, 1).setOrigin(0, 0).setDepth(30);
  }

  // ── input: place or select ───────────────────────────────────────────────────
  private onFieldTap(p: Phaser.Input.Pointer): void {
    if (this.over) return;
    if (p.y >= HUD_TOP) return; // HUD handles its own buttons
    const col = Math.floor(p.x / CELL);
    const row = Math.floor(p.y / CELL);
    if (!isInsideGrid(col, row)) return;
    const key = `${col},${row}`;

    // If a tower is here → select it (open upgrade panel).
    const existing = this.towers.find((t) => t.col === col && t.row === row);
    if (existing) { this.selectTower(existing); return; }

    // Empty cell: if a build tower is chosen + affordable + buildable → place it.
    if (this.buildId && !this.blocked.has(key) && !this.occupied.has(key)) {
      const cost = TOWERS[this.buildId].tiers[0].upgradeCost;
      if (this.money >= cost) {
        this.placeTower(this.buildId, col, row);
        this.money -= cost;
        this.refreshHud();
        this.audio.play(AudioKeys.Place);
      }
      return;
    }
    // tapped empty grass with nothing selected → clear selection
    this.clearSelection();
  }

  private placeTower(id: TowerId, col: number, row: number): Tower {
    const { x, y } = cellCenter(col, row);
    const t = new Tower(this, id, col, row, x, y);
    this.towers.push(t);
    this.occupied.add(`${col},${row}`);
    return t;
  }

  private selectTower(t: Tower): void {
    this.clearSelection();
    this.selectedTower = t;
    t.setSelected(true);
    this.rangePreview.setPosition(t.x, t.y).setRadius(t.stats.range).setVisible(true);
    this.showUpgradePanel(t);
    this.audio.play(AudioKeys.Click);
  }

  private clearSelection(): void {
    if (this.selectedTower) this.selectedTower.setSelected(false);
    this.selectedTower = null;
    this.rangePreview.setVisible(false);
    this.upgradePanel.setVisible(false);
  }

  // ── main loop ─────────────────────────────────────────────────────────────────
  update(time: number, deltaMs: number): void {
    if (this.over) return;
    const dt = deltaMs / 1000;

    // 1. spawn enemies for the active wave
    if (this.waveActive && this.spawnQueue.length > 0 && time >= this.nextSpawnAt) {
      this.spawnEnemy(this.spawnQueue.shift()!);
      this.nextSpawnAt = time + Tuning.spawnInterval;
    }

    // 2. move enemies
    let aliveCount = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      aliveCount++;
      if (e.step(dt) === 'end') {
        e.despawn();
        this.lives -= 1;
        this.refreshHud();
        this.audio.play(AudioKeys.Lose);
        this.cameras.main.shake(120, 0.006);
        if (this.lives <= 0) { this.gameOver(); return; }
      }
    }

    // 3. towers aim + fire
    const liveEnemies = this.enemies.filter((e) => !e.dead);
    for (const t of this.towers) {
      const shot = t.update(time, liveEnemies);
      if (shot) this.fireTower(t, shot.angle);
    }

    // 4. bullets fly + resolve
    for (const obj of this.bullets.getChildren()) {
      const b = obj as Bullet;
      if (!b.active) continue;
      if (b.step(dt, GAME_WIDTH, FIELD_H)) { b.despawn(); continue; }
      // hit-test against enemies
      for (const e of liveEnemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) <= 14) {
          this.resolveHit(b, e);
          b.despawn();
          break;
        }
      }
    }

    // 5. wave end?
    if (this.waveActive && this.spawnQueue.length === 0 && aliveCount === 0) {
      this.waveActive = false;
      this.money += 40 + this.wave * 6; // end-of-wave bonus
      this.refreshHud();
      if (this.wave >= Tuning.waveCount) { this.win(); return; }
      this.startBtn.setVisible(true);
    }
  }

  private fireTower(t: Tower, angle: number): void {
    const b = this.bullets.getFirstDead(false) as Bullet | null;
    if (!b) return;
    b.fire(t.def.bulletTex, t.x, t.y, angle, t.def.bulletSpeed, t.stats.damage, t.def.splash);
    this.muzzleFlash(t.x + Math.cos(angle) * 16, t.y + Math.sin(angle) * 16);
    this.audio.playPitched(AudioKeys.Shoot);
  }

  private resolveHit(b: Bullet, hit: Enemy): void {
    this.audio.playPitched(AudioKeys.Hit);
    if (b.splash > 0) {
      // AoE: damage all enemies in radius + a boom
      this.boom(b.x, b.y);
      this.cameras.main.shake(70, 0.003);
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) <= b.splash) {
          if (e.takeDamage(b.damage)) this.killEnemy(e);
        }
      }
    } else {
      if (hit.takeDamage(b.damage)) this.killEnemy(hit);
    }
  }

  private killEnemy(e: Enemy): void {
    if (e.dead) return;
    this.money += e.bounty;
    this.refreshHud();
    this.boom(e.x, e.y);
    this.audio.play(AudioKeys.Explode);
    e.despawn();
  }

  // ── waves ─────────────────────────────────────────────────────────────────────
  private startWave(): void {
    if (this.waveActive || this.over) return;
    this.wave += 1;
    this.waveActive = true;
    this.startBtn.setVisible(false);
    this.refreshHud();
    // build the spawn queue: more + tougher enemies each wave
    const count = Math.round(Tuning.enemyCountBase + (this.wave - 1) * Tuning.enemyCountPerWave);
    const q: EnemyId[] = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      if (this.wave >= 6 && r < 0.2) q.push('heavy');
      else if (this.wave >= 3 && r < 0.5) q.push('medium');
      else q.push('light');
    }
    this.spawnQueue = q;
    this.nextSpawnAt = 0;
  }

  private spawnEnemy(id: EnemyId): void {
    const e = this.enemies.find((x) => x.dead);
    if (!e) return;
    const def = ENEMIES[id];
    const hpScale = Math.pow(1 + Tuning.enemyHpPerWave, this.wave - 1);
    e.spawn(def, Math.round(def.hp * hpScale), Tuning.enemySpeed, Tuning.bountyBase, this.waypoints);
  }

  // ── juice ─────────────────────────────────────────────────────────────────────
  private muzzleFlash(x: number, y: number): void {
    const f = this.add.circle(x, y, 5, 0xffcd75, 0.9).setDepth(13);
    this.tweens.add({ targets: f, alpha: 0, scale: 1.6, duration: 90, onComplete: () => f.destroy() });
  }
  private boom(x: number, y: number): void {
    const e = this.add.image(x, y, TextureKeys.Explosion).setScale(0.4).setDepth(14).setAlpha(0.95);
    this.tweens.add({ targets: e, alpha: 0, scale: 1.1, duration: 260, ease: 'Quad.easeOut', onComplete: () => e.destroy() });
  }

  // ── HUD + shop + upgrade ──────────────────────────────────────────────────────
  private buildHud(): void {
    const top = 6;
    this.add.image(20, top + 12, TextureKeys.EnemyHeavy).setScale(0.45).setDepth(61); // heart-ish icon stand-in
    this.livesText = this.add.text(34, top + 4, `${Tuning.startLives}`, { fontFamily: 'monospace', fontSize: '16px', color: '#ff6b6b', stroke: '#1a1c2c', strokeThickness: 3 }).setDepth(61);
    this.moneyText = this.add.text(GAME_WIDTH / 2, top + 4, `$${this.money}`, { fontFamily: 'monospace', fontSize: '16px', color: '#ffd23f', stroke: '#1a1c2c', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(61);
    this.waveText = this.add.text(GAME_WIDTH - 12, top + 4, 'Wave 0', { fontFamily: 'monospace', fontSize: '14px', color: '#73eff7', stroke: '#1a1c2c', strokeThickness: 3 }).setOrigin(1, 0).setDepth(61);

    const muteBtn = this.add.text(12, top + 4, this.audio.muted ? '[M]' : '[S]', { fontFamily: 'monospace', fontSize: '11px', color: '#8a91b4' }).setDepth(61).setVisible(false);
    void muteBtn;
  }

  private buildShop(): void {
    // 3 tower buy buttons in the HUD strip
    const y = HUD_TOP + 56;
    this.startBtn = this.add.text(GAME_WIDTH / 2, HUD_TOP + 18, 'START WAVE', {
      fontFamily: 'monospace', fontSize: '18px', color: '#a7f070', stroke: '#1a1c2c', strokeThickness: 4,
      backgroundColor: '#2a2038', padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setDepth(40).setInteractive({ useHandCursor: true });
    this.startBtn.on('pointerup', () => { this.audio.play(AudioKeys.Click); this.startWave(); });

    TOWER_IDS.forEach((id, i) => {
      const def = TOWERS[id];
      const x = GAME_WIDTH * (0.2 + i * 0.3);
      const c = this.add.container(x, y).setDepth(40);
      const bg = this.add.rectangle(0, 0, 116, 64, 0x2a2038).setStrokeStyle(2, 0x4a3a6a);
      const base = this.add.image(-32, 0, def.baseTex).setScale(0.7);
      const turret = this.add.image(-32, 0, def.turretTex).setScale(0.7);
      const name = this.add.text(2, -22, def.name, { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' }).setOrigin(0, 0);
      const cost = this.add.text(2, 2, `$${def.tiers[0].upgradeCost}`, { fontFamily: 'monospace', fontSize: '13px', color: '#ffd23f' }).setOrigin(0, 0);
      c.add([bg, base, turret, name, cost]);
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.selectBuild(id));
      c.setData('id', id); c.setData('bg', bg);
      this.shopButtons.push(c);
    });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18, 'Tap a tower then tap a grass cell to build · tap a tower to upgrade', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8a7aa6', align: 'center', wordWrap: { width: GAME_WIDTH - 20 },
    }).setOrigin(0.5).setDepth(40);
  }

  private selectBuild(id: TowerId): void {
    this.audio.play(AudioKeys.Click);
    this.clearSelection();
    this.buildId = this.buildId === id ? null : id;
    for (const c of this.shopButtons) {
      const on = c.getData('id') === id && this.buildId === id;
      (c.getData('bg') as Phaser.GameObjects.Rectangle).setStrokeStyle(2, on ? 0x7cf59b : 0x4a3a6a);
    }
  }

  private buildUpgradePanel(): void {
    this.upgradePanel = this.add.container(GAME_WIDTH / 2, HUD_TOP + 56).setDepth(45).setVisible(false);
    const bg = this.add.rectangle(0, 0, GAME_WIDTH - 24, 64, 0x241c34).setStrokeStyle(2, 0xffe066);
    this.upgradePanel.add(bg);
  }

  private showUpgradePanel(t: Tower): void {
    // rebuild contents each open (simple + safe)
    this.upgradePanel.removeAll(true);
    const bg = this.add.rectangle(0, 0, GAME_WIDTH - 24, 64, 0x241c34).setStrokeStyle(2, 0xffe066);
    const info = this.add.text(-GAME_WIDTH / 2 + 18, -22, `${t.def.name}  Lv${t.tier + 1}\nDMG ${t.stats.damage} · RNG ${t.stats.range} · ${(1000 / t.stats.fireInterval).toFixed(1)}/s`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#e8dcff',
    }).setOrigin(0, 0.5);
    this.upgradePanel.add([bg, info]);
    if (t.canUpgrade) {
      const btn = this.add.text(GAME_WIDTH / 2 - 70, 0, `UP $${t.nextUpgradeCost}`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#a7f070', backgroundColor: '#2a2038', padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerup', () => {
        if (this.money >= t.nextUpgradeCost) {
          this.money -= t.nextUpgradeCost;
          t.upgrade();
          this.refreshHud();
          this.audio.play(AudioKeys.Place);
          this.rangePreview.setRadius(t.stats.range);
          this.showUpgradePanel(t); // refresh
        }
      });
      this.upgradePanel.add(btn);
    } else {
      this.upgradePanel.add(this.add.text(GAME_WIDTH / 2 - 70, 0, 'MAX', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd23f' }).setOrigin(0.5));
    }
    this.upgradePanel.setVisible(true);
  }

  private refreshHud(): void {
    this.moneyText.setText(`$${this.money}`);
    this.livesText.setText(`${Math.max(0, this.lives)}`);
    this.waveText.setText(`Wave ${this.wave}/${Tuning.waveCount}`);
  }

  // ── end states ────────────────────────────────────────────────────────────────
  private gameOver(): void {
    if (this.over) return;
    this.over = true;
    this.audio.play(AudioKeys.Lose);
    const best = (this.registry.get(RegistryKeys.BestWave) as number) ?? 0;
    if (this.wave > best) this.registry.set(RegistryKeys.BestWave, this.wave);
    this.endOverlay(`DEFEATED\nWave ${this.wave}\nTAP TO RETRY`, '#ff6b6b');
  }
  private win(): void {
    if (this.over) return;
    this.over = true;
    const best = (this.registry.get(RegistryKeys.BestWave) as number) ?? 0;
    if (this.wave > best) this.registry.set(RegistryKeys.BestWave, this.wave);
    this.endOverlay('VICTORY!\nAll waves cleared\nTAP TO PLAY AGAIN', '#a7f070');
  }
  private endOverlay(msg: string, color: string): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.72).setOrigin(0).setDepth(90);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, msg, {
      fontFamily: 'monospace', fontSize: '28px', color, align: 'center', stroke: '#1a1c2c', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(91);
    this.time.delayedCall(700, () => {
      this.input.once('pointerup', () => this.scene.start(SceneKeys.Menu));
    });
  }
}
