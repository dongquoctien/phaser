import Phaser from 'phaser';
import { SceneKeys, AudioKeys, TextureKeys, mapBestKey, mapClearedKey } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, CELL, FIELD_H, HUD_TOP, Tuning } from '../config';
import { Zombie } from '../objects/Zombie';
import { Projectile } from '../objects/Projectile';
import { Hero } from '../objects/Hero';
import { Audio } from '../systems/Audio';
import { HEROES, HERO_IDS, ZOMBIES, heroPower, heroStars, type HeroId, type ZombieId, type HeroDef, type HeroTier } from '../types/roster';
import { MAPS, MAP_COUNT, pathSet, pathWaypoints, cellCenter, isInsideGrid, type MapDef } from '../types/map';

declare const __DEV__: boolean;

export class GameScene extends Phaser.Scene {
  private audio!: Audio;
  private map!: MapDef; // the map being played (chosen in MapSelectScene)
  private zombies: Zombie[] = [];
  private projectiles!: Phaser.GameObjects.Group;
  private heroes: Hero[] = [];
  private padByCell = new Map<string, { x: number; y: number; taken: boolean }>();
  private waypoints: { x: number; y: number }[] = [];

  private gold = 0;
  private lives = 0;
  private wave = 0;
  private waveActive = false;
  private spawnQueue: ZombieId[] = [];
  private nextSpawnAt = 0;
  private over = false;
  private countdownActive = false;
  private countdownEndsAt = 0; // scene-time (ms) when the next wave auto-starts

  // UI
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private heroPicker!: Phaser.GameObjects.Container;
  private upgradePanel!: Phaser.GameObjects.Container;
  private selectedPadKey: string | null = null;
  private selectedHero: Hero | null = null;
  private pickerOpenedBy = -1; // pointer id of the tap that opened the picker (-1 = none)
  private detailBox!: Phaser.GameObjects.Container; // hero-detail pane inside the picker
  private listHighlights = new Map<HeroId, Phaser.GameObjects.Rectangle>();

  constructor() {
    super(SceneKeys.Game);
  }

  create(data?: { mapIndex?: number }): void {
    this.map = MAPS[Math.min(data?.mapIndex ?? 0, MAP_COUNT - 1)];
    this.zombies = [];
    this.heroes = [];
    this.padByCell = new Map();
    this.waypoints = pathWaypoints(this.map);
    this.gold = this.map.startGold;
    this.lives = Tuning.startLives;
    this.wave = 0;
    this.waveActive = false;
    this.spawnQueue = [];
    this.over = false;
    this.countdownActive = false;
    this.selectedPadKey = null;
    this.selectedHero = null;

    this.audio = new Audio(this);
    this.drawMap();

    this.projectiles = this.add.group({ classType: Projectile, maxSize: Tuning.poolBullets });
    for (let i = 0; i < Tuning.poolBullets; i++) this.projectiles.add(new Projectile(this), true);
    this.projectiles.getChildren().forEach((p) => (p as Projectile).despawn());
    for (let i = 0; i < Tuning.poolEnemies; i++) {
      const z = new Zombie(this);
      this.add.existing(z);
      this.zombies.push(z);
    }

    this.buildHud();
    this.buildHeroPicker();
    this.buildUpgradePanel();

    this.input.on('pointerdown', this.onFieldTap, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', this.onFieldTap, this));

    // Prep countdown before wave 1 — time to place a few heroes, then it auto-starts.
    this.beginCountdown(Tuning.prepSeconds);

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      (this as unknown as Record<string, unknown>).__dev = {
        state: () => ({ wave: this.wave, gold: this.gold, lives: this.lives, heroes: this.heroes.length, zombies: this.zombies.filter((z) => !z.dead).length, over: this.over, countdown: this.countdownActive ? Math.ceil((this.countdownEndsAt - this.time.now) / 1000) : 0 }),
        gold: (n: number) => { this.gold = n; this.refreshHud(); },
        place: (id: HeroId, padIndex: number) => {
          const cell = this.map.pads[padIndex];
          if (cell) this.placeHero(id, cell[0], cell[1]);
        },
        mapName: () => this.map.name,
        startWave: () => this.startWave(),
        skip: () => this.skipCountdown(),
        heroIds: HERO_IDS,
      };
    }
  }

  // ── map ─────────────────────────────────────────────────────────────────────
  private drawMap(): void {
    const path = pathSet(this.map);
    for (let r = 0; r < GAME_HEIGHT / CELL; r++) {
      for (let c = 0; c < GAME_WIDTH / CELL; c++) {
        if (r * CELL >= FIELD_H) continue;
        const { x, y } = cellCenter(c, r);
        const onPath = path.has(`${c},${r}`);
        // +1px display size so neighbouring tiles overlap and never show a seam.
        this.add.image(x, y, onPath ? TextureKeys.Path : TextureKeys.Grass)
          .setDisplaySize(CELL + 1, CELL + 1).setDepth(onPath ? 1 : 0);
      }
    }
    for (const d of this.map.decor) {
      if (!isInsideGrid(d.cell[0], d.cell[1])) continue;
      const { x, y } = cellCenter(d.cell[0], d.cell[1]);
      this.add.image(x, y, d.kind === 'tree' ? TextureKeys.Tree : TextureKeys.Rock).setDepth(4);
    }
    // hero pads
    for (const [c, r] of this.map.pads) {
      const { x, y } = cellCenter(c, r);
      this.add.image(x, y, TextureKeys.Pad).setDepth(2);
      this.padByCell.set(`${c},${r}`, { x, y, taken: false });
    }
    // HUD strip background
    this.add.rectangle(0, HUD_TOP, GAME_WIDTH, GAME_HEIGHT - HUD_TOP, 0x141019, 1).setOrigin(0, 0).setDepth(30);
  }

  // ── input: open hero-picker on a pad, or select a placed hero ─────────────────
  private onFieldTap(p: Phaser.Input.Pointer): void {
    if (this.over) return;
    // While the picker is open, ignore field taps entirely — the card zones (on
    // top) handle picking and the CLOSE button cancels. Closing here would race
    // the card's pointerup and eat the pick.
    if (this.heroPicker.visible) return;
    if (p.y >= HUD_TOP) return; // HUD handles its own buttons (incl. picker/panel)
    const col = Math.floor(p.x / CELL);
    const row = Math.floor(p.y / CELL);
    const key = `${col},${row}`;

    // tapped a placed hero → select for upgrade
    const hero = this.heroes.find((h) => h.col === col && h.row === row);
    if (hero) { this.selectHero(hero); return; }

    // tapped an empty pad → open the hero picker for that pad
    const pad = this.padByCell.get(key);
    if (pad && !pad.taken) { this.openHeroPicker(key, p.id); return; }

    // tapped elsewhere → clear any selection / close menus
    this.clearSelection();
  }

  private placeHero(id: HeroId, col: number, row: number): Hero | null {
    const pad = this.padByCell.get(`${col},${row}`);
    if (!pad || pad.taken) return null;
    const h = new Hero(this, id, col, row, pad.x, pad.y);
    this.heroes.push(h);
    pad.taken = true;
    return h;
  }

  private selectHero(h: Hero): void {
    this.clearSelection();
    this.selectedHero = h;
    h.setSelected(true);
    this.showUpgradePanel(h);
    this.audio.play(AudioKeys.Click);
  }

  private clearSelection(): void {
    if (this.selectedHero) this.selectedHero.setSelected(false);
    this.selectedHero = null;
    this.selectedPadKey = null;
    for (const hl of this.listHighlights.values()) hl.setVisible(false);
    this.upgradePanel.setVisible(false);
    this.heroPicker.setVisible(false);
    if (!this.waveActive && !this.over) this.showStartBtn(true);
  }

  // START WAVE is modal-exclusive with the picker/upgrade panel: hide it AND drop
  // its input when a panel is open, so it never sits (even invisibly) under another
  // control. Keeps the layout probe and real taps unambiguous.
  private showStartBtn(on: boolean): void {
    this.startBtn.setVisible(on);
    if (on) this.startBtn.setInteractive({ useHandCursor: true });
    else this.startBtn.disableInteractive();
  }

  // ── main loop ─────────────────────────────────────────────────────────────────
  update(time: number, deltaMs: number): void {
    if (this.over) return;
    const dt = deltaMs / 1000;

    if (this.waveActive && this.spawnQueue.length > 0 && time >= this.nextSpawnAt) {
      this.spawnZombie(this.spawnQueue.shift()!);
      this.nextSpawnAt = time + Tuning.spawnInterval;
    }

    // move zombies
    let alive = 0;
    for (const z of this.zombies) {
      if (z.dead) continue;
      // a poison tick may have killed it inside step → check after
      const res = z.step(dt, time);
      if (z.dead) continue;
      alive++;
      if (res === 'end') {
        z.despawn();
        this.lives -= 1;
        this.refreshHud();
        this.audio.play(AudioKeys.Lose);
        this.cameras.main.shake(120, 0.006);
        if (this.lives <= 0) { this.gameOver(); return; }
      } else if (z.hp <= 0) {
        // died from a DoT tick this frame
        this.killZombie(z);
      }
    }

    // heroes act
    const live = this.zombies.filter((z) => !z.dead);
    for (const h of this.heroes) {
      const intent = h.update(time, live);
      if (intent) this.resolveFire(h, intent, live, time);
    }

    // projectiles fly + resolve
    for (const obj of this.projectiles.getChildren()) {
      const pr = obj as Projectile;
      if (!pr.active) continue;
      if (pr.step(dt, GAME_WIDTH, FIELD_H)) { pr.despawn(); continue; }
      for (const z of live) {
        if (z.dead) continue;
        if (Math.hypot(z.x - pr.x, z.y - pr.y) <= 13) {
          this.resolveProjectileHit(pr, z, live, time);
          break;
        }
      }
    }

    // wave end?
    if (this.waveActive && this.spawnQueue.length === 0 && alive === 0) {
      this.waveActive = false;
      this.gold += 45 + this.wave * 8;
      this.refreshHud();
      if (this.wave >= Tuning.waveCount) { this.win(); return; }
      this.beginCountdown(Tuning.betweenSeconds); // auto-start the next wave after a breather
    }

    // countdown tick → auto-start when it elapses
    if (this.countdownActive && !this.waveActive) {
      if (time >= this.countdownEndsAt) this.startWave();
      else this.refreshCountdown();
    }
  }

  // ── fire resolution: this is where the 15 distinct skills live ────────────────
  private resolveFire(h: Hero, intent: { target: Zombie | null; angle: number }, live: Zombie[], now: number): void {
    const def = h.def;
    const s = h.stats;
    switch (def.attack) {
      case 'projectile': {
        if (!intent.target) return;
        this.audio.playPitched(AudioKeys.Shoot);
        const isCrit = def.skill === 'crit' && Math.random() < (def.critChance ?? 0);
        const buff = this.buffAt(h.x, h.y);
        const dmg = (isCrit ? s.damage * (def.critMul ?? 1) : s.damage) * buff;
        if (def.skill === 'multishot') {
          // fire a bolt at each of the N front-most targets
          const targets = this.frontN(live, h, s.range, def.shots ?? 3);
          for (const t of targets) {
            const a = Math.atan2(t.y - h.y, t.x - h.x);
            this.spawnProjectile(h, def, s, a, dmg, false);
          }
        } else if (def.skill === 'doubleshot') {
          // two bolts at the front target, slightly fanned
          for (let i = 0; i < (def.shots ?? 2); i++) {
            this.spawnProjectile(h, def, s, intent.angle + (i === 0 ? -0.08 : 0.08), dmg, false);
          }
        } else {
          this.spawnProjectile(h, def, s, intent.angle, dmg, isCrit);
        }
        this.muzzle(h.x + Math.cos(intent.angle) * 14, h.y + Math.sin(intent.angle) * 14, def.tint);
        break;
      }
      case 'melee': {
        const mdmg = s.damage * this.buffAt(h.x, h.y);
        if (def.skill === 'cleave') {
          const hits = h.inRange(live, s.range);
          for (const z of hits) this.damageZombie(z, mdmg, h, live, now);
          this.slashFx(h.x, h.y, def.tint);
        } else {
          // doublestrike: two quick hits on one target
          if (!intent.target) return;
          this.damageZombie(intent.target, mdmg, h, live, now);
          this.time.delayedCall(90, () => { if (!intent.target!.dead) this.damageZombie(intent.target!, mdmg, h, live, this.time.now); });
          this.slashFx(intent.target.x, intent.target.y, def.tint);
        }
        this.audio.playPitched(AudioKeys.Hit);
        break;
      }
      case 'nova': {
        const ndmg = s.damage * this.buffAt(h.x, h.y);
        const hits = h.inRange(live, s.range);
        this.novaFx(h.x, h.y, s.range, def.tint);
        this.audio.play(AudioKeys.Explode);
        this.cameras.main.shake(60, 0.003);
        for (const z of hits) {
          this.damageZombie(z, ndmg, h, live, now);
          if (def.skill === 'stun') z.applyStun(def.stunDuration ?? 1, now);
        }
        break;
      }
      case 'aura': {
        if (def.skill === 'heal' && this.lives < Tuning.startLives) {
          this.lives = Math.min(Tuning.startLives, this.lives + (def.healPerTick ?? 1));
          this.gold += 4;
          this.refreshHud();
          this.healFx(h.x, h.y);
        }
        // goldaura is passive — handled in killZombie via nearby professor check
        break;
      }
    }
  }

  private spawnProjectile(h: Hero, def: HeroDef, s: HeroTier, angle: number, dmg: number, isCrit: boolean): void {
    const pr = this.projectiles.getFirstDead(false) as Projectile | null;
    if (!pr || !def.proj) return;
    pr.fire(def.proj, h.x, h.y, angle, def.projSpeed, dmg, def, s, isCrit);
  }

  private resolveProjectileHit(pr: Projectile, hit: Zombie, live: Zombie[], now: number): void {
    const def = pr.hero;
    this.audio.playPitched(AudioKeys.Hit);

    switch (def.skill) {
      case 'splash': {
        this.boom(pr.x, pr.y);
        const r = def.splashRadius ?? 40;
        for (const z of live) {
          if (z.dead) continue;
          if (Math.hypot(z.x - pr.x, z.y - pr.y) <= r) this.damageZombie(z, pr.damage, null, live, now);
        }
        break;
      }
      case 'chain': {
        let current = hit;
        const hitSet = new Set<Zombie>([current]);
        this.damageZombie(current, pr.damage, null, live, now);
        const jumps = def.chainJumps ?? 3;
        const range = def.chainRange ?? 70;
        for (let j = 0; j < jumps; j++) {
          const next = live.find((z) => !z.dead && !hitSet.has(z) && Math.hypot(z.x - current.x, z.y - current.y) <= range);
          if (!next) break;
          this.boltFx(current.x, current.y, next.x, next.y, def.tint);
          this.damageZombie(next, pr.damage * 0.8, null, live, now);
          hitSet.add(next); current = next;
        }
        break;
      }
      case 'pierce': {
        // damage the hit + up to `pierce` more along its travel direction
        this.damageZombie(hit, pr.damage, null, live, now);
        let pierced = 0;
        const max = pr.hero.pierce ?? 2;
        for (const z of live) {
          if (z === hit || z.dead) continue;
          if (Math.hypot(z.x - pr.x, z.y - pr.y) <= 22) {
            this.damageZombie(z, pr.damage, null, live, now);
            if (++pierced >= max) break;
          }
        }
        break;
      }
      case 'poison':
      case 'bleed': {
        this.damageZombie(hit, pr.damage, null, live, now);
        hit.applyPoison(def.dotDps ?? 12, def.dotDuration ?? 3, now);
        break;
      }
      case 'slow':
      case 'sticky': {
        this.damageZombie(hit, pr.damage, null, live, now);
        hit.applySlow(def.slowFactor ?? 0.5, def.slowDuration ?? 2, now);
        break;
      }
      case 'bounce': {
        // water splash: small AoE damage + a brief slow on the cluster
        this.boom(pr.x, pr.y, 0.45);
        const r = def.splashRadius ?? 40;
        for (const z of live) {
          if (z.dead) continue;
          if (Math.hypot(z.x - pr.x, z.y - pr.y) <= r) {
            this.damageZombie(z, pr.damage, null, live, now);
            z.applySlow(def.slowFactor ?? 0.6, def.slowDuration ?? 1.5, now);
          }
        }
        break;
      }
      case 'knockback': {
        this.damageZombie(hit, pr.damage, null, live, now);
        hit.knockBack(def.knockback ?? 24);
        break;
      }
      case 'execute': {
        // bonus damage to wounded zombies
        const frac = hit.maxHp > 0 ? hit.hp / hit.maxHp : 1;
        const dmg = frac <= (def.executeThreshold ?? 0.3) ? pr.damage * (def.executeMul ?? 2.5) : pr.damage;
        if (dmg > pr.damage) this.boom(pr.x, pr.y, 0.5);
        this.damageZombie(hit, dmg, null, live, now);
        break;
      }
      case 'rapidfire':
      case 'crit':
      default: {
        if (pr.isCrit) this.boom(pr.x, pr.y, 0.6);
        this.damageZombie(hit, pr.damage, null, live, now);
        break;
      }
    }
    pr.despawn();
  }

  // Combined damage multiplier from every buffaura hero whose range covers (x,y).
  private buffAt(x: number, y: number): number {
    let mul = 1;
    for (const h of this.heroes) {
      if (h.def.skill !== 'buffaura') continue;
      if (Phaser.Math.Distance.Between(x, y, h.x, h.y) <= h.stats.range) mul *= (h.def.buffMul ?? 1.25);
    }
    return mul;
  }

  private frontN(live: Zombie[], h: Hero, range: number, n: number): Zombie[] {
    return live
      .filter((z) => !z.dead && Phaser.Math.Distance.Between(z.x, z.y, h.x, h.y) <= range)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, n);
  }

  private damageZombie(z: Zombie, amount: number, _by: Hero | null, _live: Zombie[], _now: number): void {
    if (z.applyDamage(amount)) this.killZombie(z);
  }

  private killZombie(z: Zombie): void {
    if (z.dead) return;
    let reward = z.bounty;
    // professor gold aura: +bonus if a professor is nearby
    for (const h of this.heroes) {
      if (h.def.skill === 'goldaura' && Phaser.Math.Distance.Between(z.x, z.y, h.x, h.y) <= h.stats.range) {
        reward += h.def.goldBonus ?? 3;
        break;
      }
    }
    this.gold += reward;
    this.refreshHud();
    this.boom(z.x, z.y);
    this.audio.play(AudioKeys.Explode);
    z.despawn();
  }

  // ── waves ─────────────────────────────────────────────────────────────────────
  // Begin a countdown to the next wave. Shows the timer + a SKIP button; auto-starts
  // the wave when it elapses. No-op if a wave is already running or the game's over.
  private beginCountdown(seconds: number): void {
    if (this.waveActive || this.over) return;
    this.countdownActive = true;
    this.countdownEndsAt = this.time.now + seconds * 1000;
    if (!this.upgradePanel.visible && !this.heroPicker.visible) this.showStartBtn(true);
    this.refreshCountdown();
  }

  // SKIP / START pressed (or countdown elapsed) → launch the wave now. Skipping
  // early grants a small gold bonus as a reward for confidence.
  private skipCountdown(): void {
    if (this.over) return;
    if (this.countdownActive && this.time.now < this.countdownEndsAt) {
      this.gold += Tuning.skipBonus; // early-start reward
    }
    this.startWave();
  }

  private refreshCountdown(): void {
    if (this.countdownActive && !this.waveActive) {
      const left = Math.max(0, Math.ceil((this.countdownEndsAt - this.time.now) / 1000));
      this.countdownText.setText(`Next wave in ${left}s`).setVisible(true);
      this.startBtn.setText(`SKIP ▶  +$${Tuning.skipBonus}`);
    } else {
      this.countdownText.setVisible(false);
    }
  }

  private startWave(): void {
    if (this.waveActive || this.over) return;
    this.countdownActive = false;
    this.countdownText.setVisible(false);
    this.wave += 1;
    this.waveActive = true;
    this.showStartBtn(false);
    this.refreshHud();
    const count = Math.round(Tuning.enemyCountBase + (this.wave - 1) * Tuning.enemyCountPerWave);
    const q: ZombieId[] = [];
    const boss = this.wave % 5 === 0; // boss every 5th wave
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      if (this.wave >= 6 && r < 0.25) q.push('brute');
      else if (this.wave >= 3 && r < 0.45) q.push('runner');
      else q.push('walker');
    }
    if (boss) q.push('boss');
    this.spawnQueue = q;
    this.nextSpawnAt = 0;
  }

  private spawnZombie(id: ZombieId): void {
    const z = this.zombies.find((x) => x.dead);
    if (!z) return;
    const def = ZOMBIES[id];
    const hpScale = Math.pow(1 + Tuning.enemyHpPerWave, this.wave - 1) * this.map.enemyHpMul;
    z.spawn(def, Math.round(def.hp * hpScale), Tuning.enemySpeed, Tuning.bountyBase, this.waypoints);
  }

  // ── juice ─────────────────────────────────────────────────────────────────────
  private muzzle(x: number, y: number, hex: string): void {
    const f = this.add.circle(x, y, 5, Phaser.Display.Color.HexStringToColor(hex).color, 0.9).setDepth(13);
    this.tweens.add({ targets: f, alpha: 0, scale: 1.6, duration: 90, onComplete: () => f.destroy() });
  }
  private boom(x: number, y: number, scale = 0.4): void {
    const e = this.add.image(x, y, TextureKeys.Explosion).setScale(scale).setDepth(14).setAlpha(0.95);
    this.tweens.add({ targets: e, alpha: 0, scale: scale + 0.7, duration: 250, ease: 'Quad.easeOut', onComplete: () => e.destroy() });
  }
  private slashFx(x: number, y: number, hex: string): void {
    const s = this.add.image(x, y, TextureKeys.Slash).setDepth(13).setAlpha(0.95).setTint(Phaser.Display.Color.HexStringToColor(hex).color).setAngle(Phaser.Math.Between(-30, 30));
    this.tweens.add({ targets: s, alpha: 0, scale: 1.4, duration: 160, onComplete: () => s.destroy() });
  }
  private novaFx(x: number, y: number, r: number, hex: string): void {
    const ring = this.add.circle(x, y, 8, Phaser.Display.Color.HexStringToColor(hex).color, 0.35).setDepth(13);
    this.tweens.add({ targets: ring, radius: r, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }
  private boltFx(x1: number, y1: number, x2: number, y2: number, hex: string): void {
    const g = this.add.graphics().setDepth(13);
    g.lineStyle(2, Phaser.Display.Color.HexStringToColor(hex).color, 0.9).lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
  }
  private healFx(x: number, y: number): void {
    const p = this.add.image(x, y, TextureKeys.Spark).setDepth(13).setTint(0xa7f070);
    this.tweens.add({ targets: p, y: y - 18, alpha: 0, duration: 500, onComplete: () => p.destroy() });
  }

  // ── HUD + hero picker + upgrade panel ─────────────────────────────────────────
  private buildHud(): void {
    // All HUD lives in the FOOTER strip (HUD_TOP..GAME_HEIGHT). The play field
    // above is left clean. Footer rows, top → bottom:
    //   stats row (lives · gold · wave) → countdown → START/SKIP → hint
    const statY = HUD_TOP + 10;
    // lives (zombie icon + count) on the left
    this.add.image(18, statY + 8, TextureKeys.ZombieWalker).setScale(0.5).setDepth(61);
    this.livesText = this.add.text(34, statY, `${Tuning.startLives}`, { fontFamily: 'monospace', fontSize: '16px', color: '#ff6b6b', stroke: '#1a1c2c', strokeThickness: 3 }).setDepth(61);
    // gold centred
    this.goldText = this.add.text(GAME_WIDTH / 2, statY, `$${this.gold}`, { fontFamily: 'monospace', fontSize: '16px', color: '#ffd23f', stroke: '#1a1c2c', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(61);
    // wave on the right
    this.waveText = this.add.text(GAME_WIDTH - 12, statY, 'Wave 0', { fontFamily: 'monospace', fontSize: '14px', color: '#73eff7', stroke: '#1a1c2c', strokeThickness: 3 }).setOrigin(1, 0).setDepth(61);

    // Countdown label (below the stats row) — shows "Next wave in Ns".
    this.countdownText = this.add.text(GAME_WIDTH / 2, HUD_TOP + 40, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#73eff7',
    }).setOrigin(0.5, 0).setDepth(40);

    // The action button: during a countdown it reads "SKIP ▶ (+$bonus)" and starts
    // the wave early; otherwise "START WAVE".
    this.startBtn = this.add.text(GAME_WIDTH / 2, HUD_TOP + 64, 'START WAVE', {
      fontFamily: 'monospace', fontSize: '17px', color: '#a7f070', stroke: '#1a1c2c', strokeThickness: 4,
      backgroundColor: '#2a2038', padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setDepth(40).setInteractive({ useHandCursor: true });
    this.startBtn.on('pointerup', () => { this.audio.play(AudioKeys.Click); this.skipCountdown(); });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 12, 'Tap a pad → pick a hero · tap a hero to upgrade', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8a7aa6', align: 'center', wordWrap: { width: GAME_WIDTH - 16 },
    }).setOrigin(0.5).setDepth(40);
  }

  // Scrollable-ish hero picker: a grid of all 15 hero icons in the HUD band.
  private buildHeroPicker(): void {
    // Near-fullscreen overlay (21 heroes need the room). Dim backdrop + a 4-column
    // grid of hero cards (icon + name + cost), each a named interactive zone so the
    // layout probe can see every button.
    // Two-pane layout (Rise-of-Kingdoms style): a scrollable hero LIST on the left,
    // a DETAIL pane on the right. Clicking a list entry only previews it; the user
    // must press PLACE to actually deploy. Non-interactive dim so it can't swallow
    // list taps; cancel via CLOSE.
    // Depth above the HUD (61) so the full-screen picker covers the lives/gold/wave
    // texts instead of letting them bleed through the header.
    this.heroPicker = this.add.container(0, 0).setDepth(70).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.96).setOrigin(0);
    dim.name = 'picker-dim';
    const header = this.add.text(12, 12, 'CHOOSE A HERO', { fontFamily: 'monospace', fontSize: '15px', color: '#a7f070' });
    const close = this.add.text(GAME_WIDTH - 12, 12, '✕', { fontFamily: 'monospace', fontSize: '18px', color: '#ff6b6b' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.name = 'picker-close';
    close.on('pointerup', (p: Phaser.Input.Pointer) => { if (!this.isOpeningTap(p)) this.clearSelection(); });
    this.heroPicker.add([dim, header, close]);

    // ── LEFT: hero list (3 columns of avatar tiles) ──
    const listX = 10, listY = 40, tileW = 74, tileH = 60, cols = 2;
    this.listHighlights.clear();
    HERO_IDS.forEach((id, i) => {
      const def = HEROES[id];
      const tx = listX + (i % cols) * tileW + tileW / 2;
      const ty = listY + Math.floor(i / cols) * tileH + tileH / 2;
      const cell = this.add.rectangle(tx, ty, tileW - 6, tileH - 6, 0x241c34, 0.96).setStrokeStyle(1, 0x4a3a6a);
      const hl = this.add.rectangle(tx, ty, tileW - 6, tileH - 6, 0x000000, 0).setStrokeStyle(2, 0xa7f070).setVisible(false);
      const icon = fitImage(this.add.image(tx, ty - 8, def.tex), 36);
      const name = this.add.text(tx, ty + 18, def.name, { fontFamily: 'monospace', fontSize: '8px', color: '#cdd6e6' }).setOrigin(0.5);
      const hit = this.add.zone(tx, ty, tileW - 6, tileH - 6).setInteractive({ useHandCursor: true });
      hit.name = `pick:${id}`;
      hit.on('pointerup', (p: Phaser.Input.Pointer) => this.previewHero(id, p));
      this.listHighlights.set(id, hl);
      this.heroPicker.add([cell, hl, icon, name, hit]);
    });

    // ── RIGHT: detail pane (rebuilt per selection in renderDetail) ──
    const detailX = listX + cols * tileW + 12;
    this.detailBox = this.add.container(detailX, 40).setDepth(51);
    this.heroPicker.add(this.detailBox);
  }

  private openHeroPicker(padKey: string, pointerId = -1): void {
    this.clearSelection();
    this.selectedPadKey = padKey;
    this.pickerOpenedBy = pointerId; // swallow this tap's pointerup (see isOpeningTap)
    this.showStartBtn(false);
    this.heroPicker.setVisible(true);
    this.renderDetail(null); // empty prompt until a hero is picked
  }

  /** True if this pointerup belongs to the tap that just opened the picker (consume it). */
  private isOpeningTap(p?: Phaser.Input.Pointer): boolean {
    if (this.pickerOpenedBy === -1) return false;
    if (!p || p.id === this.pickerOpenedBy) { this.pickerOpenedBy = -1; return true; }
    return false;
  }

  /** Click a hero in the list → preview it in the detail pane (does NOT place). */
  private previewHero(id: HeroId, _p?: Phaser.Input.Pointer): void {
    // No opening-tap guard here: previewing is harmless (it only shows detail, never
    // deploys), so the very tap that opened the picker is allowed to preview a hero
    // straight away — otherwise the first click would be swallowed and the user
    // would have to click twice. Placement still requires the separate PLACE button.
    this.pickerOpenedBy = -1; // consume the lock so CLOSE behaves normally afterwards
    this.audio.play(AudioKeys.Click);
    for (const [hid, hl] of this.listHighlights) hl.setVisible(hid === id);
    this.renderDetail(id);
  }

  // Rebuild the detail pane for the previewed hero (or an empty prompt). The panel
  // height hugs its content: each text block is laid out below the previous using
  // its measured height, then the background + PLACE button wrap the total.
  private renderDetail(id: HeroId | null): void {
    this.detailBox.removeAll(true);
    const w = GAME_WIDTH - (10 + 2 * 74 + 12) - 10; // remaining width on the right
    if (!id) {
      const h0 = 120;
      this.detailBox.add(this.add.rectangle(0, 0, w, h0, 0x1c1730, 0.98).setOrigin(0).setStrokeStyle(2, 0x4a3a6a));
      this.detailBox.add(this.add.text(w / 2, h0 / 2, 'Tap a hero\non the left', { fontFamily: 'monospace', fontSize: '12px', color: '#8a7aa6', align: 'center' }).setOrigin(0.5));
      return;
    }
    const def = HEROES[id];
    const t = def.tiers[0];
    const accent = Phaser.Display.Color.HexStringToColor(def.tint).color;
    const cx = w / 2;
    const items: Phaser.GameObjects.GameObject[] = [];

    // portrait + name + stars + power (compact, top-aligned)
    items.push(fitImage(this.add.image(cx, 56, def.tex), 80));
    items.push(this.add.text(cx, 100, def.name, { fontFamily: 'monospace', fontSize: '17px', color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 4 }).setOrigin(0.5));
    const stars = heroStars(def);
    items.push(this.add.text(cx, 120, '★★★★★☆☆☆☆☆'.slice(5 - stars, 10 - stars), { fontFamily: 'monospace', fontSize: '15px', color: '#ffd23f' }).setOrigin(0.5));
    items.push(this.add.text(cx, 140, `⚔ POWER ${heroPower(def)}`, { fontFamily: 'monospace', fontSize: '12px', color: '#ffcd75' }).setOrigin(0.5));

    // stats as a compact 2-column block
    const atkName: Record<string, string> = { projectile: 'Ranged', melee: 'Melee', aura: 'Aura', nova: 'Nova' };
    const left = this.add.text(14, 162, `Type  ${atkName[def.attack]}\n${t.damage > 0 ? `DMG   ${t.damage}` : 'DMG   —'}`, { fontFamily: 'monospace', fontSize: '11px', color: '#cdd6e6', lineSpacing: 4 });
    const right = this.add.text(cx + 4, 162, `Range ${t.range}\nRate  ${(1000 / t.fireInterval).toFixed(1)}/s`, { fontFamily: 'monospace', fontSize: '11px', color: '#cdd6e6', lineSpacing: 4 });
    items.push(left, right);
    let y = 162 + Math.max(left.height, right.height) + 10; // flow cursor below stats

    // skill (height-measured so BIO sits right under it)
    items.push(this.add.text(14, y, 'SKILL', { fontFamily: 'monospace', fontSize: '10px', color: def.tint }));
    y += 14;
    const skill = this.add.text(14, y, def.blurb, { fontFamily: 'monospace', fontSize: '10px', color: '#e8dcff', wordWrap: { width: w - 28 }, lineSpacing: 2 });
    items.push(skill);
    y += skill.height + 12;

    // bio / lore
    items.push(this.add.text(14, y, 'BIO', { fontFamily: 'monospace', fontSize: '10px', color: '#8a91b4' }));
    y += 14;
    const bio = this.add.text(14, y, def.lore, { fontFamily: 'monospace', fontSize: '10px', color: '#b8a8d0', fontStyle: 'italic', wordWrap: { width: w - 28 }, lineSpacing: 3 });
    items.push(bio);
    y += bio.height + 16;

    // PLACE button just below the BIO.
    const affordable = this.gold >= t.cost;
    const place = this.add.text(cx, y + 18, affordable ? `PLACE  $${t.cost}` : `NEED $${t.cost}`, {
      fontFamily: 'monospace', fontSize: '16px', color: affordable ? '#1a1c2c' : '#8a7aa6',
      backgroundColor: affordable ? '#a7f070' : '#3a2f55', padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    place.name = 'detail-place';
    place.on('pointerup', () => this.confirmPlace(id));
    items.push(place);

    // Background sized to the final content height, created ONCE (mutating a
    // Rectangle's .height after setStrokeStyle leaves a stale stroke = a filled
    // bar on the top edge). Added first so it sits behind everything.
    const panelH = y + 44;
    const bg = this.add.rectangle(0, 0, w, panelH, 0x1c1730, 0.98).setOrigin(0).setStrokeStyle(2, accent);
    this.detailBox.add(bg);
    this.detailBox.add(items);
  }

  // PLACE pressed → deploy the previewed hero on the selected pad (if affordable).
  private confirmPlace(id: HeroId): void {
    if (!this.selectedPadKey) return;
    const [c, r] = this.selectedPadKey.split(',').map(Number);
    const cost = HEROES[id].tiers[0].cost;
    if (this.gold < cost) { this.audio.play(AudioKeys.Lose); return; }
    if (this.placeHero(id, c, r)) {
      this.gold -= cost;
      this.refreshHud();
      this.audio.play(AudioKeys.Place);
    }
    this.clearSelection();
  }

  private buildUpgradePanel(): void {
    // Sits in the lower footer, BELOW the stats row (lives/gold/wave at HUD_TOP+10)
    // and ABOVE the hint note at the very bottom. Depth 62 so it covers the
    // countdown/START button while open, but the stats row (depth 61) stays
    // readable on its own line above it.
    this.upgradePanel = this.add.container(GAME_WIDTH / 2, HUD_TOP + 86).setDepth(62).setVisible(false);
    const bg = this.add.rectangle(0, 0, GAME_WIDTH - 16, 88, 0x241c34, 0.98).setStrokeStyle(2, 0xffe066);
    this.upgradePanel.add(bg);
  }

  private showUpgradePanel(h: Hero): void {
    this.upgradePanel.removeAll(true);
    const w = GAME_WIDTH - 16;
    const bg = this.add.rectangle(0, 0, w, 88, 0x241c34, 0.98).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(h.def.tint).color);
    const icon = fitImage(this.add.image(-w / 2 + 26, -20, h.def.tex), 40);
    const title = this.add.text(-w / 2 + 50, -38, `${h.def.name}  Lv${h.tier + 1}`, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' });
    const stats = this.add.text(-w / 2 + 50, -20, `DMG ${h.stats.damage} · RNG ${h.stats.range} · ${(1000 / h.stats.fireInterval).toFixed(1)}/s`, { fontFamily: 'monospace', fontSize: '10px', color: '#cdd6e6' });
    const blurb = this.add.text(-w / 2 + 14, 4, h.def.blurb, { fontFamily: 'monospace', fontSize: '10px', color: h.def.tint, wordWrap: { width: w - 120 } });
    this.upgradePanel.add([bg, icon, title, stats, blurb]);
    if (h.canUpgrade) {
      const btn = this.add.text(w / 2 - 64, 0, `UP $${h.nextUpgradeCost}`, { fontFamily: 'monospace', fontSize: '14px', color: '#a7f070', backgroundColor: '#2a2038', padding: { x: 10, y: 6 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerup', () => {
        if (this.gold >= h.nextUpgradeCost) {
          this.gold -= h.nextUpgradeCost;
          h.upgrade();
          this.refreshHud();
          this.audio.play(AudioKeys.Place);
          h.setSelected(true);
          this.showUpgradePanel(h);
        }
      });
      this.upgradePanel.add(btn);
    } else {
      this.upgradePanel.add(this.add.text(w / 2 - 64, 0, 'MAX', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd23f' }).setOrigin(0.5));
    }
    this.upgradePanel.setVisible(true);
    this.showStartBtn(false);
  }

  private refreshHud(): void {
    this.goldText.setText(`$${this.gold}`);
    this.livesText.setText(`${Math.max(0, this.lives)}`);
    this.waveText.setText(`Wave ${this.wave}/${Tuning.waveCount}`);
  }

  // ── end states ────────────────────────────────────────────────────────────────
  private gameOver(): void {
    if (this.over) return;
    this.over = true;
    this.audio.play(AudioKeys.Lose);
    this.saveBest();
    this.endOverlay(`OVERRUN\nWave ${this.wave}\nTAP TO RETRY`, '#ff6b6b');
  }
  private win(): void {
    if (this.over) return;
    this.over = true;
    this.saveBest();
    // mark this map cleared → unlocks the next one in MapSelect
    this.registry.set(mapClearedKey(this.map.id), true);
    const last = this.map.id >= MAP_COUNT - 1;
    const msg = last
      ? 'ALL MAPS CLEARED!\nYou are the champion\nTAP TO CONTINUE'
      : `VICTORY!\n${this.map.name} cleared\nNext map unlocked!\nTAP TO CONTINUE`;
    this.endOverlay(msg, '#a7f070');
  }
  private saveBest(): void {
    const key = mapBestKey(this.map.id);
    const best = (this.registry.get(key) as number) ?? 0;
    if (this.wave > best) this.registry.set(key, this.wave);
  }
  private endOverlay(msg: string, color: string): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.72).setOrigin(0).setDepth(90);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, msg, { fontFamily: 'monospace', fontSize: '24px', color, align: 'center', stroke: '#1a1c2c', strokeThickness: 6 }).setOrigin(0.5).setDepth(91);
    this.time.delayedCall(700, () => { this.input.once('pointerup', () => this.scene.start(SceneKeys.MapSelect)); });
  }
}

// Scale an Image so its (full-res hero PNG) height becomes `targetH` px on screen.
function fitImage(img: Phaser.GameObjects.Image, targetH: number): Phaser.GameObjects.Image {
  const h = img.height || targetH;
  return img.setScale(targetH / h);
}
