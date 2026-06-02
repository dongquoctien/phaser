import Phaser from 'phaser';
import { SceneKeys, AudioKeys, MusicKeys, TextureKeys, Fonts, mapBestKey, mapClearedKey } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, CELL, FIELD_H, HUD_TOP, Tuning } from '../config';
import { Zombie } from '../objects/Zombie';
import { Projectile } from '../objects/Projectile';
import { Hero } from '../objects/Hero';
import { Audio } from '../systems/Audio';
import { HEROES, HERO_IDS, ZOMBIES, MAP_BOSS, MAP_MINIONS, MAX_LEVEL, heroPower, heroStars, type HeroId, type ZombieId, type HeroDef, type HeroTier } from '../types/roster';
import { MAPS, MAP_COUNT, pathSet, pathWaypoints, cellCenter, isInsideGrid, type MapDef } from '../types/map';

declare const __DEV__: boolean;

export class GameScene extends Phaser.Scene {
  private audio!: Audio;
  private map!: MapDef; // the map being played (chosen in MapSelectScene)
  private zombies: Zombie[] = [];
  private projectiles!: Phaser.GameObjects.Group;
  private heroes: Hero[] = [];
  private padByCell = new Map<string, { x: number; y: number; taken: boolean; img: Phaser.GameObjects.Image }>();
  private waypoints: { x: number; y: number }[] = [];

  private gold = 0;
  private lives = 0;
  private wave = 0;
  private waveActive = false;
  private spawnQueue: ZombieId[] = [];
  private nextSpawnAt = 0;
  private nextGrowlAt = 0; // ambient zombie-growl timer
  private over = false;
  private countdownActive = false;
  private countdownEndsAt = 0; // scene-time (ms) when the next wave auto-starts
  private awaitingFirstStart = false; // wave 1 waits for a manual START press (no timer)
  private slowmo = 1; // game-logic time multiplier; <1 during the boss-kill cinematic
  private cinematicActive = false; // true while a boss-kill slow-mo cinematic plays

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
    this.slowmo = 1;
    this.cinematicActive = false;
    this.anims.globalTimeScale = 1;
    this.cameras.main.setZoom(1);
    this.selectedPadKey = null;
    this.selectedHero = null;

    this.audio = new Audio(this);
    this.audio.playMusic(MusicKeys.Bg); // looping background music
    this.drawMap();
    this.drawWeather(); // ambient leaves (Normal) / rain (Hard)

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

    // Wave 1 waits for a manual START press (no countdown). The official clock /
    // first wave only begins when the player taps START — gives unlimited prep time.
    this.awaitingFirstStart = true;
    this.showStartBtn(true);
    this.refreshCountdown(); // shows the START label (no timer)

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
    const T = TextureKeys;
    // 1. Grass field: one of 5 real grass variants per cell (+ mirror flip) so the
    //    field reads as a lush, non-repeating surface instead of one tile stamped.
    const GRASS = [T.Grass0, T.Grass1, T.Grass2, T.Grass3, T.Grass4];
    for (let r = 0; r < GAME_HEIGHT / CELL; r++) {
      for (let c = 0; c < GAME_WIDTH / CELL; c++) {
        if (r * CELL >= FIELD_H) continue;
        const { x, y } = cellCenter(c, r);
        const variant = GRASS[(c * 7 + r * 13 + ((c * r) % 5)) % GRASS.length];
        const img = this.add.image(x, y, variant).setDisplaySize(CELL + 1, CELL + 1).setDepth(0);
        img.setFlipX(((c + r) & 1) === 1);
        img.setFlipY((c & 1) === 1);
      }
    }
    // 2. The road: a smooth rounded dirt ribbon following the path centreline,
    //    with a soft grass-toned shoulder — drawn the way the reference map does
    //    it (one continuous winding road, rounded turns), not square dirt cells.
    this.drawRoad();

    // 3. Decor — dense + varied, like the reference (random fitting variant/cell).
    const TREES = [T.TreeRound, T.TreePine, T.TreeBig, T.TreeSmall1, T.TreeSmall2];
    const ROCKS = [T.RockBig1, T.RockBig2, T.RockMed1, T.RockMed2];
    const EXTRAS = [T.Bush, T.Flowers, T.Log, T.Mushroom];
    for (const d of this.map.decor) {
      if (!isInsideGrid(d.cell[0], d.cell[1])) continue;
      const { x, y } = cellCenter(d.cell[0], d.cell[1]);
      const tex = d.kind === 'tree' ? Phaser.Utils.Array.GetRandom(TREES) : Phaser.Utils.Array.GetRandom(ROCKS);
      const spr = this.add.image(x, y + CELL * 0.18, tex).setOrigin(0.5, 0.86).setDepth(4 + y * 0.001);
      spr.setScale((CELL * (d.kind === 'tree' ? 1.6 : 1.2)) / Math.max(spr.width, spr.height));
    }
    this.scatterExtras(pathSet(this.map), EXTRAS);

    // 4. hero pads (blue when empty; green once a hero stands on it)
    for (const [c, r] of this.map.pads) {
      const { x, y } = cellCenter(c, r);
      const img = this.add.image(x, y, T.Pad).setDepth(2).setDisplaySize(CELL * 1.05, CELL * 1.05);
      this.padByCell.set(`${c},${r}`, { x, y, taken: false, img });
    }
    this.add.rectangle(0, HUD_TOP, GAME_WIDTH, GAME_HEIGHT - HUD_TOP, 0x141019, 1).setOrigin(0, 0).setDepth(30);
  }

  /** Ambient weather per map: falling leaves on the Normal map, rain on the Hard
   *  map. Particle textures are baked to tiny canvas textures (no asset needed).
   *  Drawn above the ground (depth 6) but below the HUD (depth 30). */
  private drawWeather(): void {
    const id = this.map.id;
    if (id === 1) this.spawnLeaves();
    else if (id === 2) this.spawnRain();
  }

  private ensureDot(key: string, w: number, h: number, color: number, round = false): void {
    if (this.textures.exists(key)) return;
    const c = this.textures.createCanvas(key, w, h)!;
    const ctx = c.getContext();
    ctx.fillStyle = Phaser.Display.Color.IntegerToColor(color).rgba;
    if (round) { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 7); ctx.fill(); }
    else ctx.fillRect(0, 0, w, h);
    c.refresh();
  }

  private spawnLeaves(): void {
    // a few leaf-colour blobs drifting down + swaying
    for (const [k, col] of [['leaf-a', 0xd9a441], ['leaf-b', 0xc4632a], ['leaf-c', 0x7fa84a]] as const) {
      this.ensureDot(k, 6, 4, col, true);
    }
    // one emitter per leaf colour so each drifts independently (avoids the typed
    // multi-texture API); staggered frequencies read as a varied leaf-fall.
    const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    (['leaf-a', 'leaf-b', 'leaf-c'] as const).forEach((tex, i) => {
      const em = this.add.particles(0, 0, tex, {
        x: { min: 0, max: GAME_WIDTH }, y: -10,
        lifespan: 7000, frequency: 850 + i * 200, quantity: 1,
        speedY: { min: 18, max: 34 }, speedX: { min: -14, max: 14 },
        scale: { min: 0.8, max: 1.6 }, rotate: { min: 0, max: 360 },
        alpha: { start: 0.9, end: 0.65 },
      }).setDepth(6);
      emitters.push(em);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => emitters.forEach((e) => e.destroy()));
  }

  private spawnRain(): void {
    this.ensureDot('raindrop', 2, 12, 0xbcd4f0);
    const em = this.add.particles(0, 0, 'raindrop', {
      x: { min: -40, max: GAME_WIDTH }, y: -16,
      lifespan: 900, frequency: 24, quantity: 2,
      speedY: { min: 620, max: 760 }, speedX: { min: 90, max: 130 }, // slanted rain
      scaleY: { min: 0.8, max: 1.4 }, scaleX: 1,
      alpha: { start: 0.5, end: 0.2 },
    }).setDepth(6);
    // a faint blue overcast tint over the field
    this.add.rectangle(0, 0, GAME_WIDTH, FIELD_H, 0x2a4a6a, 0.12).setOrigin(0, 0).setDepth(5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => em.destroy());
  }

  /** Draw the road as a smooth, rounded dirt ribbon following the path centreline,
   *  hand-styled to match the reference: dirt-textured body with rounded turns, a
   *  ragged grass-blade fringe along both edges, scattered pebbles and faint cracks.
   *  Baked to a CanvasTexture (Phaser 4 WebGL has no geometry masks). */
  private drawRoad(): void {
    const pts = (this.waypoints.length ? this.waypoints : pathWaypoints(this.map)).map((p) => ({ x: p.x, y: p.y }));
    if (pts.length < 2) return;
    const roadW = Math.round(CELL * 0.72);

    const key = `road-${this.map.id}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    const canvas = this.textures.createCanvas(key, GAME_WIDTH, FIELD_H)!;
    const ctx = canvas.getContext();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    };
    // deterministic PRNG so the look is stable across reloads (no Math.random)
    let seed = 1337 + this.map.id * 911;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    // 1. dirt body: STROKE the path with the dirt pattern. (We must stroke, not
    //    clip+fill — ctx.clip() uses the path's FILL region, which for a zig-zag
    //    polyline is the whole enclosed polygon, so the dirt would balloon across
    //    the field and cover the grass pads. Stroking keeps it a true ribbon.)
    const dirtImg = this.textures.get(TextureKeys.Path).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const pat = ctx.createPattern(dirtImg, 'repeat');
    ctx.save();
    trace(); ctx.lineWidth = roadW; ctx.strokeStyle = pat ?? '#a5875a'; ctx.stroke();
    // dirt detail clipped to the ribbon: build a polygon hull of the stroked segments
    // and clip to it (so speckles/pebbles stay on the dirt only).
    ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * (roadW / 2), ny = dx / len * (roadW / 2);
      ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(b.x + nx, b.y + ny);
      ctx.lineTo(b.x - nx, b.y - ny); ctx.lineTo(a.x - nx, a.y - ny); ctx.closePath();
    }
    ctx.clip();
    for (let i = 0; i < 240; i++) {
      const x = rnd() * GAME_WIDTH, y = rnd() * FIELD_H, s = 1 + rnd() * 2;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,92,56,0.45)' : 'rgba(196,170,120,0.45)';
      ctx.fillRect(x, y, s, s);
    }
    for (let i = 0; i < 22; i++) {
      const x = rnd() * GAME_WIDTH, y = rnd() * FIELD_H, r = 1.6 + rnd() * 2;
      ctx.fillStyle = '#8a8f9e'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, 7); ctx.fill();
    }
    ctx.restore();

    // 2. soft grass-blade fringe along both dirt edges — the ONLY edge treatment, so
    //    the road blends into grass without a hard rectangle or a dark-green border.
    const half = roadW / 2;
    const blades = ['#3f7a4a', '#56a05f', '#6fb86a'];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;     // along
      const nx = -uy, ny = ux;                // normal
      for (let d = 0; d < len; d += 2) {
        const px = a.x + ux * d, py = a.y + uy * d;
        for (const side of [1, -1] as const) {
          const ex = px + nx * half * side, ey = py + ny * half * side; // dirt edge point
          const bl = 1.5 + rnd() * 2.5;        // short fine blades onto the dirt
          ctx.strokeStyle = blades[(Math.floor(d) + (side > 0 ? 0 : 1)) % blades.length] as string;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - nx * bl * side + (rnd() - 0.5) * 1.5, ey - ny * bl * side + (rnd() - 0.5) * 1.5);
          ctx.stroke();
        }
      }
    }

    canvas.refresh();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(1);
  }

  /** Sprinkle small ground extras on a deterministic set of empty grass cells. */
  private scatterExtras(path: Set<string>, extras: string[]): void {
    const taken = new Set<string>(this.map.pads.map(([c, r]) => `${c},${r}`));
    for (const d of this.map.decor) taken.add(`${d.cell[0]},${d.cell[1]}`);
    const cols = GAME_WIDTH / CELL, rows = FIELD_H / CELL;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${c},${r}`;
        if (path.has(key) || taken.has(key)) continue;
        // deterministic sparse scatter (~1 in 9 empty cells), edges favoured
        if ((c * 7 + r * 13) % 9 !== 0) continue;
        const { x, y } = cellCenter(c, r);
        const tex = extras[(c + r) % extras.length];
        const spr = this.add.image(x, y, tex).setOrigin(0.5, 0.7).setDepth(3 + y * 0.001).setAlpha(0.95);
        spr.setScale((CELL * 0.7) / Math.max(spr.width, spr.height));
        if (++i > 14) return;
      }
    }
  }

  // ── input: open hero-picker on a pad, or select a placed hero ─────────────────
  private onFieldTap(p: Phaser.Input.Pointer): void {
    if (this.over) return;
    if (this.cinematicActive) return; // ignore taps during the boss-kill cinematic
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
    pad.img.setTexture(TextureKeys.PadOn); // blue → green glow once occupied
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
    // slow-motion during the boss-kill cinematic scales all game-logic movement
    // (zombies, projectiles, DoT ticks) — tweens/anims are slowed via timeScale.
    const dt = (deltaMs / 1000) * this.slowmo;

    if (this.waveActive && this.spawnQueue.length > 0 && time >= this.nextSpawnAt) {
      const next = this.spawnQueue.shift()!;
      // the real boss is the final spawn of a boss wave (id matches this map's boss)
      const asBoss = this.spawnQueue.length === 0 && this.wave % 5 === 0 && next === (MAP_BOSS[this.map.id] ?? 'boss');
      this.spawnZombie(next, asBoss);
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
        z.playEndAttack(); // chomp at the base, then despawns itself
        this.lives -= 1;
        this.refreshHud();
        this.audio.play(AudioKeys.Lose);
        this.cameras.main.shake(120, 0.006);
        if (this.lives <= 0) { this.gameOver(); return; }
      } else if (z.hp <= 0 && !z.dying) {
        // died from a DoT tick this frame (skip if its death anim already started,
        // else it would be "killed" — and rewarded — every frame until it despawns)
        this.killZombie(z);
        continue;
      }
      // boss hero-kill skill: on cooldown, blast the nearest hero in reach
      if (z.bossInfo && this.heroes.length && time >= z.nextHeroKillAt) {
        this.bossKillHero(z);
        z.nextHeroKillAt = time + z.bossInfo.skillCdMs;
      }
    }

    // ambient growls while zombies are on the field (throttled in Audio).
    // If the timer is WAY overdue (>2s) the tab was just backgrounded — the scene
    // clock jumped ahead — so skip the growl and reschedule instead of barking the
    // instant we return.
    if (alive > 0 && time >= this.nextGrowlAt) {
      if (time - this.nextGrowlAt < 2000) {
        this.audio.play(Math.random() < 0.5 ? AudioKeys.ZombieGrrr : AudioKeys.ZombieGrrr1);
      }
      this.nextGrowlAt = time + 2500 + Math.random() * 3500;
    }

    // heroes act — exclude zombies mid death/end animation so heroes don't waste
    // shots on something already leaving play.
    const live = this.zombies.filter((z) => !z.dead && !z.dying);
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
      this.gold += Tuning.waveRewardBase + this.wave * Tuning.waveRewardPerWave;
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
      case 'bounceball': {
        // Shiba: a rubber ball that hits the target, then BOUNCES to the nearest
        // adjacent zombie, and again — `bounces` total hops (2/3/4 by tier). Each
        // bounce keeps near-full damage (slight 0.9 falloff so it stays punchy).
        let current = hit;
        const hitSet = new Set<Zombie>([current]);
        this.damageZombie(current, pr.damage, null, live, now);
        const bounces = pr.tier.bounces ?? 2; // scales per upgrade tier (2 → 3 → 4)
        const range = def.chainRange ?? 90;
        let dmg = pr.damage;
        for (let b = 0; b < bounces; b++) {
          let next: Zombie | null = null, best = Infinity;
          for (const z of live) {
            if (z.dead || hitSet.has(z)) continue;
            const d = Math.hypot(z.x - current.x, z.y - current.y);
            if (d <= range && d < best) { best = d; next = z; }
          }
          if (!next) break;
          dmg *= 0.9;
          this.ballBounceFx(current.x, current.y, next.x, next.y, def.tint);
          this.damageZombie(next, dmg, null, live, now);
          hitSet.add(next); current = next;
        }
        break;
      }
      case 'gnaw': {
        // Jibgor: a relentless bite. Each hit deals damage AND adds a vulnerability
        // stack, so the same zombie takes more and more from every subsequent bite.
        this.damageZombie(hit, pr.damage, null, live, now);
        hit.gnaw();
        break;
      }
      case 'roar': {
        // Lionyori: the shot lands and she lets out a ferocious roar — zombies near
        // the impact are damaged and briefly FROZEN in fear (stun).
        this.novaFx(pr.x, pr.y, def.splashRadius ?? 56, def.tint);
        this.audio.play(AudioKeys.Explode);
        this.cameras.main.shake(50, 0.0022);
        const r = def.splashRadius ?? 56;
        for (const z of live) {
          if (z.dead) continue;
          if (Math.hypot(z.x - pr.x, z.y - pr.y) <= r) {
            this.damageZombie(z, pr.damage, null, live, now);
            z.applyStun(def.stunDuration ?? 0.8, now);
          }
        }
        break;
      }
      case 'aircannon': {
        // Mr.Hoang (Doraemon's Air Cannon): a compressed-air blast that PIERCES a
        // line of zombies and knocks every one of them back down the road.
        this.damageZombie(hit, pr.damage, null, live, now);
        hit.knockBack(def.knockback ?? 30);
        let pierced = 0;
        const max = def.pierce ?? 3;
        for (const z of live) {
          if (z === hit || z.dead) continue;
          if (Math.hypot(z.x - pr.x, z.y - pr.y) <= 26) {
            this.damageZombie(z, pr.damage, null, live, now);
            z.knockBack(def.knockback ?? 30);
            if (++pierced >= max) break;
          }
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
    if (z.dead || z.dying) return; // already dying → don't award gold again
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
    this.shatter(z.x, z.y); // chunks burst apart (no explosion flash)
    // death sound only (no Explode — it was the "drum" stacking on mass kills).
    this.audio.play(Math.random() < 0.5 ? AudioKeys.ZombieDie : AudioKeys.ZombieDie2);
    z.playDeath(); // topple + fade, then despawns itself (gold already awarded)
  }

  /** Boss special — a tense cinematic: pick the nearest hero, SLOW the whole scene
   *  to a crawl for 3s, lock a red targeting reticle onto the doomed hero (camera
   *  eases toward it), then snap back to full speed and execute it. */
  private bossKillHero(boss: Zombie): void {
    if (this.cinematicActive) return; // one execution cinematic at a time
    const REACH = 150;
    let target: Hero | null = null, best = REACH;
    for (const h of this.heroes) {
      const d = Math.hypot(h.x - boss.x, h.y - boss.y);
      if (d < best) { best = d; target = h; }
    }
    if (!target) return;
    const victim = target;
    this.cinematicActive = true;
    // close any open menu first — UI lives on the main camera, so the cinematic
    // zoom would otherwise scale the hero-picker / upgrade panel too.
    this.clearSelection();
    boss.playBossAttack();
    this.audio.play(AudioKeys.BossKillSlow); // tense slow-mo sting

    // ── enter slow-motion: game logic crawls, anims slow, time eases down ──
    this.slowmo = 0.12;
    this.anims.globalTimeScale = 0.18;
    this.tweens.add({ targets: this.cameras.main, zoom: 1.35, duration: 500, ease: 'Quad.out' });
    this.cameras.main.pan(victim.x, victim.y, 500, Phaser.Math.Easing.Quadratic.Out);

    // dark vignette to focus attention
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x080008, 0.4).setOrigin(0, 0).setDepth(18).setScrollFactor(0).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 400 });

    // ── target-lock reticle on the doomed hero ──
    const lock = this.add.container(victim.x, victim.y).setDepth(22);
    const ring1 = this.add.circle(0, 0, 40, 0x000000, 0).setStrokeStyle(3, 0xff2a2a, 0.95);
    const ring2 = this.add.circle(0, 0, 26, 0x000000, 0).setStrokeStyle(2, 0xff6b6b, 0.9);
    const cross = this.add.graphics();
    cross.lineStyle(2, 0xff2a2a, 0.95);
    for (const a of [0, 90, 180, 270]) {
      const rad = Phaser.Math.DegToRad(a);
      cross.lineBetween(Math.cos(rad) * 18, Math.sin(rad) * 18, Math.cos(rad) * 46, Math.sin(rad) * 46);
    }
    lock.add([ring1, ring2, cross]);
    this.tweens.add({ targets: ring1, angle: 360, duration: 1600, repeat: -1 });        // spin outer
    this.tweens.add({ targets: ring2, angle: -360, duration: 1300, repeat: -1 });        // spin inner
    this.tweens.add({ targets: lock, scale: { from: 1.8, to: 1 }, duration: 450, ease: 'Back.out' });
    this.tweens.add({ targets: lock, alpha: { from: 0.4, to: 1 }, duration: 220, yoyo: true, repeat: -1 }); // pulse
    victim.setTint(0xff8888); // mark the doomed hero

    // ── after 3s of real time, snap back and execute ──
    this.time.delayedCall(3000, () => {
      lock.destroy();
      this.tweens.add({ targets: dim, alpha: 0, duration: 200, onComplete: () => dim.destroy() });
      // restore normal speed
      this.slowmo = 1;
      this.anims.globalTimeScale = 1;
      this.tweens.add({ targets: this.cameras.main, zoom: 1, duration: 260, ease: 'Quad.in' });
      this.cameras.main.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 260, Phaser.Math.Easing.Quadratic.In);

      this.cinematicActive = false;
      if (!victim.active) return; // hero already removed some other way
      // the kill blow
      const g = this.add.graphics().setDepth(20);
      g.lineStyle(4, 0xff2a2a, 0.95).lineBetween(boss.x, boss.y, victim.x, victim.y);
      g.fillStyle(0xff2a2a, 0.5).fillCircle(victim.x, victim.y, 26);
      this.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });
      this.boom(victim.x, victim.y, 0.8);
      this.cameras.main.shake(200, 0.01);
      this.audio.play(AudioKeys.Push); // the kill blow
      this.removeHero(victim);
    });
  }

  /** Remove a hero from play and free its pad (used by sell + boss kill). */
  private removeHero(h: Hero, refund = 0): void {
    if (refund > 0) { this.gold += refund; this.refreshHud(); }
    const pad = this.padByCell.get(`${h.col},${h.row}`);
    if (pad) { pad.taken = false; pad.img.setTexture(TextureKeys.Pad); }
    this.heroes = this.heroes.filter((x) => x !== h);
    if (this.selectedHero === h) this.clearSelection();
    h.destroyAll();
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
    // wave 1 manual start: no skip bonus (there was no timer to skip)
    if (!this.awaitingFirstStart && this.countdownActive && this.time.now < this.countdownEndsAt) {
      this.gold += Tuning.skipBonus; // early-start reward
    }
    this.startWave();
  }

  private refreshCountdown(): void {
    if (this.awaitingFirstStart && !this.waveActive) {
      // wave 1: no timer — just prompt the player to start when ready
      this.countdownText.setText('Place your heroes, then START').setVisible(true);
      this.startBtn.setText('START ▶');
    } else if (this.countdownActive && !this.waveActive) {
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
    this.awaitingFirstStart = false; // first START consumed; later waves auto-countdown
    this.countdownText.setVisible(false);
    this.wave += 1;
    this.waveActive = true;
    this.showStartBtn(false);
    this.refreshHud();
    const count = Math.round(Tuning.enemyCountBase + (this.wave - 1) * Tuning.enemyCountPerWave);
    const q: ZombieId[] = [];
    const isBossWave = this.wave % 5 === 0; // boss every 5th wave
    // minion pool depends on the map: harder maps can roll lower-tier bosses as
    // ordinary minions (cross-difficulty mixing). 'walker' is the always-on base.
    const pool = MAP_MINIONS[this.map.id] ?? ['walker', 'slow', 'brute'];
    const elite = pool.filter((z) => z === 'boss' || z === 'khoai'); // boss-as-minion
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      // rare elite minion (a lower boss walking in the wave) on harder maps, mid/late waves
      if (elite.length && this.wave >= 7 && r < 0.06) q.push(Phaser.Utils.Array.GetRandom(elite));
      else if (this.wave >= 6 && pool.includes('brute') && r < 0.28) q.push('brute');
      else if (this.wave >= 3 && pool.includes('slow') && r < 0.5) q.push('slow');
      else q.push('walker');
    }
    if (isBossWave) {
      const bossId = MAP_BOSS[this.map.id] ?? 'boss';
      q.push(bossId);
      this.audio.playMusic(MusicKeys.Boss);
      this.audio.play(AudioKeys.ZombieBossSfx);
      this.showBossIntro(bossId);
    } else {
      this.audio.playMusic(MusicKeys.Bg);
      this.showWaveBanner(this.wave); // caution-tape "WAVE X" sweep
    }
    this.spawnQueue = q;
    this.nextSpawnAt = 0;
  }

  /** Caution-tape "WAVE N" banner: a diagonal yellow/black hazard strip that pops
   *  in (fade + scale up), holds, then fades out shrinking — shown on non-boss waves. */
  private showWaveBanner(wave: number): void {
    const bandH = 86, cy = GAME_HEIGHT * 0.32;
    const root = this.add.container(GAME_WIDTH / 2, cy).setDepth(94).setAngle(-7);
    // hazard band: dark base + diagonal yellow stripes drawn via Graphics
    const w = GAME_WIDTH + 120;
    const g = this.add.graphics();
    g.fillStyle(0x1a1a1a, 1).fillRect(-w / 2, -bandH / 2, w, bandH);
    g.fillStyle(0xffc60a, 1);
    const sw = 34; // stripe width
    for (let x = -w / 2 - bandH; x < w / 2; x += sw * 2) {
      g.beginPath();
      g.moveTo(x, bandH / 2); g.lineTo(x + sw, bandH / 2);
      g.lineTo(x + sw + bandH, -bandH / 2); g.lineTo(x + bandH, -bandH / 2);
      g.closePath(); g.fillPath();
    }
    // top + bottom accent edges
    g.fillStyle(0xff3b30, 1).fillRect(-w / 2, -bandH / 2 - 3, w, 3).fillRect(-w / 2, bandH / 2, w, 3);
    // the label, in Bangers, on a small dark plate so it reads over the stripes
    const plate = this.add.rectangle(0, 0, 260, 56, 0x1a1a1a, 0.92).setStrokeStyle(3, 0xffc60a);
    const label = this.add.text(0, 0, `WAVE ${wave}`, {
      fontFamily: Fonts.Display, fontSize: '46px', color: '#ffffff', stroke: '#1a1a1a', strokeThickness: 6,
    }).setOrigin(0.5);
    root.add([g, plate, label]);
    this.audio.play(AudioKeys.Place);
    // pop in (fade + scale up, overshoot) → hold → fade out shrinking
    root.setAlpha(0).setScale(0.5);
    this.tweens.chain({
      targets: root,
      tweens: [
        { alpha: 1, scale: 1, duration: 300, ease: 'Back.out' }, // pop in
        { alpha: 1, duration: 900 },                              // hold
        { alpha: 0, scale: 0.8, duration: 280, ease: 'Quad.in' },  // fade + shrink out
      ],
      onComplete: () => root.destroy(),
    });
  }

  /** Game-style boss intro: red screen flash + a centred banner with the boss's
   *  English name, shown for ~2.5s when a boss wave begins. */
  // Boss reveal (Zombie-Catchers-style): the boss looms BIG behind, and the boss
  // name sits IN FRONT, overlapping the lower half of the sprite, in chunky toxic-
  // green zombie lettering. Dim vignette backdrop, no stripes.
  private showBossIntro(bossId: ZombieId): void {
    const info = ZOMBIES[bossId].boss;
    const name = info?.name ?? 'BOSS';
    const fillCol = info?.fill ?? '#5ee62e';
    const outlineCol = info?.outline ?? '#0a2a0c';
    const glowCol = info?.glow ?? 0x3a1d5a;
    const sheetKey: Record<string, string> = {
      boss: TextureKeys.ZombieBossStand, khoai: TextureKeys.ZombieKhoaiStand, hakj: TextureKeys.ZombieHakjStand,
    };
    const root = this.add.container(0, 0).setDepth(96).setAlpha(0);
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT * 0.40;

    // 0. quick red flash
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff1a1a, 0.5).setOrigin(0, 0).setDepth(95);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });

    // 1. dark vignette backdrop + a soft glow behind boss (tinted to the boss theme)
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x080510, 0.7).setOrigin(0, 0);
    const glow = this.add.circle(cx, cy - 6, 150, glowCol, 0.55);
    root.add([dim, glow]);

    // 2. the boss, BIG, behind — playing its attack-1 animation (from the sheet)
    const boss = this.add.sprite(cx, cy, sheetKey[bossId] ?? TextureKeys.ZombieBossStand, 0);
    const fit = 270 / Math.max(boss.width, boss.height);
    boss.setOrigin(0.5, 0.5);
    if (this.anims.exists(`${bossId}-attackA`)) boss.play({ key: `${bossId}-attackA`, repeat: -1, frameRate: 8 });
    root.add(boss);

    // 3. boss name IN FRONT, overlapping the boss's lower half. Chunky "goo" zombie
    //    lettering themed per boss: bright themed fill, dark themed rim, white middle.
    const ny = cy + fit * boss.height * 0.30; // lower third of the sprite
    const mk = (col: string, sw: number, dy = 0) => this.add.text(cx, ny + dy, name.toUpperCase(), {
      fontFamily: Fonts.Zombie, fontSize: '58px',
      color: col, stroke: col, strokeThickness: sw, align: 'center', wordWrap: { width: GAME_WIDTH - 20 },
    }).setOrigin(0.5);
    const rim = mk(outlineCol, 14, 3);    // dark themed rim (drop)
    const white = mk('#f3fff7', 9, 1);    // white outline
    const fill = mk(fillCol, 2);          // bright themed fill
    fill.setShadow(0, 3, outlineCol, 0, true, true);
    root.add([rim, white, fill]);

    this.cameras.main.shake(300, 0.007);
    // pop the boss in (from slightly small), bounce the title up into place
    boss.setScale(fit * 0.62);
    this.tweens.add({ targets: boss, scale: fit, duration: 380, ease: 'Back.out' });
    for (const t of [rim, white, fill]) { t.setScale(0.6); this.tweens.add({ targets: t, scale: 1, duration: 420, ease: 'Back.out' }); }
    this.tweens.add({ targets: root, alpha: 1, duration: 200, yoyo: true, hold: 2100, ease: 'Quad.easeOut',
      onComplete: () => root.destroy() });
  }

  private spawnZombie(id: ZombieId, asBoss = false): void {
    const z = this.zombies.find((x) => x.dead);
    if (!z) return;
    const def = ZOMBIES[id];
    const hpScale = Math.pow(1 + Tuning.enemyHpPerWave, this.wave - 1) * this.map.enemyHpMul;
    z.spawn(def, Math.round(def.hp * hpScale), Tuning.enemySpeed, Tuning.bountyBase, this.waypoints);
    // mark the wave's headline boss so it gets the hero-kill skill (elite minions
    // of a boss type stay ordinary — no skill, no popup).
    if (asBoss && def.boss) {
      z.bossInfo = def.boss;
      z.nextHeroKillAt = this.time.now + def.boss.skillCdMs;
    }
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
  // A little ball that hops from one zombie to the next on an arc (Shiba bounce).
  private ballBounceFx(x1: number, y1: number, x2: number, y2: number, hex: string): void {
    const color = Phaser.Display.Color.HexStringToColor(hex).color;
    const ball = this.add.circle(x1, y1, 5, color, 1).setDepth(14).setStrokeStyle(1, 0x1a1c2c, 0.6);
    const arc = -Math.min(40, Math.hypot(x2 - x1, y2 - y1) * 0.35); // pop upward mid-flight
    this.tweens.add({
      targets: ball, x: x2, duration: 150, ease: 'Quad.easeIn',
      onUpdate: (tw) => { const t = tw.progress; ball.y = y1 + (y2 - y1) * t + arc * Math.sin(Math.PI * t); },
      onComplete: () => {
        // a small splat where it lands
        const s = this.add.circle(x2, y2, 6, color, 0.7).setDepth(13);
        this.tweens.add({ targets: s, radius: 12, alpha: 0, duration: 160, onComplete: () => s.destroy() });
        ball.destroy();
      },
    });
  }
  private healFx(x: number, y: number): void {
    const p = this.add.image(x, y, TextureKeys.Spark).setDepth(13).setTint(0xa7f070);
    this.tweens.add({ targets: p, y: y - 18, alpha: 0, duration: 500, onComplete: () => p.destroy() });
  }

  // Death "shatter": a burst of little chunks that fly out radially, spin, fall
  // under gravity, and fade — so a kill pops apart instead of a single static
  // flash. Chunk count is small (cheap on mass kills); colours are zombie-flesh.
  private shatter(x: number, y: number): void {
    const COLORS = [0x6aaa5a, 0x4f8a44, 0x2a7a3a, 0xb13e53]; // green flesh + a blood red
    const n = 8;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Phaser.Math.FloatBetween(-0.3, 0.3);
      const speed = Phaser.Math.FloatBetween(40, 95);
      const vx = Math.cos(ang) * speed;
      const vy = Math.sin(ang) * speed - Phaser.Math.FloatBetween(20, 60); // initial upward kick
      const size = Phaser.Math.Between(2, 4);
      const chunk = this.add.rectangle(x, y, size, size, COLORS[i % COLORS.length])
        .setDepth(14).setAngle(Phaser.Math.Between(0, 360));
      const dur = Phaser.Math.Between(380, 620);
      const gx = x + vx * (dur / 1000);
      const gy = y + vy * (dur / 1000) + 90 * (dur / 1000) * (dur / 1000); // + gravity drop
      this.tweens.add({
        targets: chunk, x: gx, y: gy, angle: chunk.angle + Phaser.Math.Between(-220, 220),
        alpha: 0, duration: dur, ease: 'Quad.easeIn',
        onComplete: () => chunk.destroy(),
      });
    }
  }

  // ── HUD + hero picker + upgrade panel ─────────────────────────────────────────
  private buildHud(): void {
    // All HUD lives in the FOOTER strip (HUD_TOP..GAME_HEIGHT). The play field
    // above is left clean. Footer rows, top → bottom:
    //   stats row (lives · gold · wave) → countdown → START/SKIP → hint
    const statY = HUD_TOP + 10;
    // lives (zombie-girl icon + count) on the left — idle frame of her sheet, scaled to ~26px
    const livesIcon = this.add.image(18, statY + 8, TextureKeys.ZombieGirlStand, 0).setDepth(61);
    livesIcon.setScale(26 / (livesIcon.height || 26));
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
    const header = this.add.text(12, 16, 'CHOOSE A HERO', { fontFamily: 'monospace', fontSize: '15px', color: '#a7f070' });
    this.heroPicker.add([dim, header]);

    // ── LEFT: hero list (2 columns of avatar tiles) ──
    // 25 heroes → 13 rows; tileH sized so the last row still fits in GAME_HEIGHT (800).
    const listX = 10, listY = 38, tileW = 74, tileH = 56, cols = 2;
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
    this.detailBox = this.add.container(detailX, 62).setDepth(51); // below the close-button row
    this.heroPicker.add(this.detailBox);

    // Close button LAST so it renders on top of the detail pane (container children
    // draw in add-order, not by depth — the detail pane would otherwise cover it).
    // A large, finger-friendly target (46px ≥ Apple's 44px minimum).
    const cw = 46, cx = GAME_WIDTH - 8 - cw / 2, cy = 8 + cw / 2;
    const closeBtn = this.add.rectangle(cx, cy, cw, cw, 0x3a2030, 0.98).setStrokeStyle(2, 0xff6b6b).setInteractive({ useHandCursor: true });
    closeBtn.name = 'picker-close';
    const closeX = this.add.text(cx, cy, '✕', { fontFamily: 'monospace', fontSize: '24px', color: '#ff6b6b' }).setOrigin(0.5);
    closeBtn.on('pointerup', (p: Phaser.Input.Pointer) => { if (!this.isOpeningTap(p)) this.clearSelection(); });
    this.heroPicker.add([closeBtn, closeX]);
  }

  private openHeroPicker(padKey: string, pointerId = -1): void {
    this.clearSelection();
    this.selectedPadKey = padKey;
    this.pickerOpenedBy = pointerId; // swallow this tap's pointerup (see isOpeningTap)
    this.showStartBtn(false);
    this.heroPicker.setVisible(true);
    // pre-select a random hero so the detail pane isn't empty on open
    const randomId = Phaser.Utils.Array.GetRandom(HERO_IDS as HeroId[]);
    this.selectHeroInPicker(randomId);
    // release the opening-tap lock on the next tick so it swallows ONLY the opening
    // pointerup — the X button then closes on the first real click (was needing 2).
    this.time.delayedCall(0, () => { this.pickerOpenedBy = -1; });
  }

  /** Highlight + show a hero in the picker detail pane (no sound, no lock change). */
  private selectHeroInPicker(id: HeroId): void {
    for (const [hid, hl] of this.listHighlights) hl.setVisible(hid === id);
    this.renderDetail(id);
  }

  /** True if this pointerup belongs to the tap that just opened the picker (consume it). */
  private isOpeningTap(p?: Phaser.Input.Pointer): boolean {
    if (this.pickerOpenedBy === -1) return false;
    if (!p || p.id === this.pickerOpenedBy) { this.pickerOpenedBy = -1; return true; }
    return false;
  }

  /** Click a hero in the list → preview it in the detail pane (does NOT place). */
  private previewHero(id: HeroId, _p?: Phaser.Input.Pointer): void {
    // Previewing only shows detail (never deploys); the opening-tap lock is cleared
    // on the next tick in openHeroPicker, so taps here always register.
    this.pickerOpenedBy = -1;
    this.audio.play(AudioKeys.Click);
    this.selectHeroInPicker(id);
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
    const placed = this.placeHero(id, c, r);
    if (placed) {
      this.gold -= cost;
      placed.spent = cost; // seed sell-refund tracking
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
    const title = this.add.text(-w / 2 + 50, -38, `${h.def.name}  Lv${h.tier + 1}/${MAX_LEVEL}`, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' });
    const stats = this.add.text(-w / 2 + 50, -20, `DMG ${h.stats.damage} · RNG ${h.stats.range} · ${(1000 / h.stats.fireInterval).toFixed(1)}/s`, { fontFamily: 'monospace', fontSize: '10px', color: '#cdd6e6' });
    const blurb = this.add.text(-w / 2 + 14, 4, h.def.blurb, { fontFamily: 'monospace', fontSize: '9px', color: h.def.tint, wordWrap: { width: w - 150 } });
    this.upgradePanel.add([bg, icon, title, stats, blurb]);

    // UP (upgrade) button — top-right
    if (h.canUpgrade) {
      const btn = this.add.text(w / 2 - 58, -22, `UP $${h.nextUpgradeCost}`, { fontFamily: 'monospace', fontSize: '13px', color: '#a7f070', backgroundColor: '#2a2038', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerup', () => {
        const cost = h.nextUpgradeCost;
        if (this.gold >= cost) {
          this.gold -= cost;
          h.spent += cost;
          h.upgrade();
          this.refreshHud();
          this.audio.play(AudioKeys.Place);
          h.setSelected(true);
          this.showUpgradePanel(h);
        } else {
          this.audio.play(AudioKeys.Lose);
        }
      });
      this.upgradePanel.add(btn);
    } else {
      this.upgradePanel.add(this.add.text(w / 2 - 58, -22, 'MAX', { fontFamily: 'monospace', fontSize: '13px', color: '#ffd23f' }).setOrigin(0.5));
    }

    // SELL button — bottom-right (refund 60% of total spent)
    const refund = Math.round(h.spent * 0.6);
    const sell = this.add.text(w / 2 - 58, 22, `SELL $${refund}`, { fontFamily: 'monospace', fontSize: '13px', color: '#ff9d5c', backgroundColor: '#382028', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    sell.name = 'hero-sell';
    sell.on('pointerup', () => {
      this.removeHero(h, refund);
      this.audio.play(AudioKeys.Click);
      this.upgradePanel.setVisible(false);
    });
    this.upgradePanel.add(sell);

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
    this.audio.stopMusic();             // silence the loop so the sting stands alone
    this.audio.play(AudioKeys.GameOver); // full-volume defeat sound
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
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, msg, { fontFamily: Fonts.Display, fontSize: '40px', color, align: 'center', stroke: '#1a1c2c', strokeThickness: 7, lineSpacing: 6 }).setOrigin(0.5).setDepth(91);
    this.time.delayedCall(700, () => { this.input.once('pointerup', () => this.scene.start(SceneKeys.MapSelect)); });
  }
}

// Scale an Image so its (full-res hero PNG) height becomes `targetH` px on screen.
function fitImage(img: Phaser.GameObjects.Image, targetH: number): Phaser.GameObjects.Image {
  const h = img.height || targetH;
  return img.setScale(targetH / h);
}
