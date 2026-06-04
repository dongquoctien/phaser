import Phaser from 'phaser';
import { SceneKeys, AudioKeys, MusicKeys, TextureKeys, Fonts, RegistryKeys, mapBestKey, mapClearedKey } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, CELL, FIELD_H, HUD_TOP, Tuning } from '../config';
import { Zombie } from '../objects/Zombie';
import { Projectile } from '../objects/Projectile';
import { Hero } from '../objects/Hero';
import { Audio } from '../systems/Audio';
import { Storage } from '../systems/Storage';
import { Api } from '../systems/Api';
import { HEROES, HERO_IDS, ZOMBIES, MAP_BOSS, MAP_MINIONS, MAX_LEVEL, heroPower, heroStars, type HeroId, type ZombieId, type HeroDef, type HeroTier } from '../types/roster';
import { MAPS, MAP_COUNT, pathSet, pathWaypoints, cellCenter, padCenter, isInsideGrid, type MapDef } from '../types/map';

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
  // ── leaderboard run metadata (server validates these to spot impossible runs) ──
  private runStartedAt = 0;  // ms epoch when wave 1 began (0 until then)
  private heroesPlaced = 0;  // total heroes deployed this run
  private kills = 0;         // total zombies killed
  private goldEarned = 0;    // cumulative gold gained (kills + wave rewards)
  private runSubmitted = false; // submit the result only once
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
  private lastPickedHero: HeroId = 'oreo'; // picker pre-selects this; defaults to Oreo, then remembers the player's last pick
  private tutorialOpen = false; // true while the How-to-Play overlay is up (blocks field taps)
  private pickerOpenedBy = -1; // pointer id of the tap that opened the picker (-1 = none)
  private detailBox!: Phaser.GameObjects.Container; // hero-detail pane inside the picker
  private listHighlights = new Map<HeroId, Phaser.GameObjects.Rectangle>();
  private listPane!: Phaser.GameObjects.Container; // scrollable hero-list column
  private listScrollMin = 0; // most-negative listPane.y (scrolled to bottom); 0 = top
  private listScrollTop = 0;  // listPane.y at the top of the list (resting position)
  private listDragged = false; // true if the last pointer interaction was a scroll-drag (suppresses the tap-select)
  private listArrowUp!: Phaser.GameObjects.Text;   // "more above" hint
  private listArrowDown!: Phaser.GameObjects.Text; // "more below" hint

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
    this.lastPickedHero = 'oreo'; // each new game starts the picker on Oreo
    this.wave = 0;
    this.runStartedAt = 0; this.heroesPlaced = 0; this.kills = 0; this.goldEarned = 0; this.runSubmitted = false;
    void Api.startSession(this.map.id); // open a leaderboard session (no-op if API off)
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

    // ── hero drag-to-merge ── (handlers live on the scene input; heroes opt in via
    // setInteractive({draggable:true}) in placeHero). Dragging a max-level hero onto
    // another same-type max-level hero merges them.
    this.input.on(Phaser.Input.Events.DRAG_START, this.onHeroDragStart, this);
    this.input.on(Phaser.Input.Events.DRAG, this.onHeroDrag, this);
    this.input.on(Phaser.Input.Events.DRAG_END, this.onHeroDragEnd, this);

    // Wave 1 waits for a manual START press (no countdown). The official clock /
    // first wave only begins when the player taps START — gives unlimited prep time.
    this.awaitingFirstStart = true;
    this.showStartBtn(true);
    this.refreshCountdown(); // shows the START label (no timer)

    // first-time tutorial overlay (once per player, persisted in the registry).
    // If they've already seen it, nudge them with the "tap a pad" toast instead.
    if (!this.registry.get(RegistryKeys.TipsSeen)) this.showTutorial();
    else this.time.delayedCall(600, () => { if (this.heroes.length === 0) this.markTip('pad'); });

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
      const { x, y } = padCenter(c, r); // nudged down for top-row pads so heroes aren't clipped
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
    if (this.tutorialOpen) return;     // How-to-Play overlay is modal — swallow field taps
    if (this.cinematicActive) return; // ignore taps during the boss-kill cinematic
    // While the picker is open, ignore field taps entirely — the card zones (on
    // top) handle picking and the CLOSE button cancels. Closing here would race
    // the card's pointerup and eat the pick.
    if (this.heroPicker.visible) return;
    if (p.y >= HUD_TOP) return; // HUD handles its own buttons (incl. picker/panel)
    if (p.x >= GAME_WIDTH - 40 && p.y <= 40) return; // top-right "?" help button zone
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
    this.heroesPlaced++;
    pad.taken = true;
    pad.img.setTexture(TextureKeys.PadOn); // blue → green glow once occupied
    // make the hero draggable so max-level same-type heroes can be merged
    h.setInteractive({ draggable: true, useHandCursor: true });
    return h;
  }

  // ── drag-to-merge ──────────────────────────────────────────────────────────────
  private onHeroDragStart(_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject): void {
    const h = obj as Hero;
    if (!(h instanceof Hero) || this.over || this.cinematicActive || this.tutorialOpen) return;
    // Only a MAX-LEVEL hero can be merge-dragged. A lower-level hero shouldn't be
    // draggable at all — leave it on its pad so the tap opens its upgrade panel
    // instead of yanking it around to no effect. A hero already at max merge (3
    // tiers) is "done" — block its drag too so it stays put.
    if (!h.isMaxLevel || h.isMaxMerged) return;
    h.setDepth(30); // float above others while dragging
    h.dragging = true;
    this.clearSelection();
  }

  private onHeroDrag(_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dragX: number, dragY: number): void {
    const h = obj as Hero;
    if (!(h instanceof Hero) || !h.dragging) return;
    h.x = dragX; h.y = dragY;
    // highlight a valid merge target under the cursor
    const tgt = this.mergeTargetUnder(h, dragX, dragY);
    for (const o of this.heroes) o.setSelected(o === tgt);
  }

  private onHeroDragEnd(_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject): void {
    const h = obj as Hero;
    if (!(h instanceof Hero) || !h.dragging) return; // not a merge-drag → nothing to settle
    h.dragging = false;
    h.setDepth(11);
    for (const o of this.heroes) o.setSelected(false);
    const tgt = this.mergeTargetUnder(h, h.x, h.y);
    if (tgt) { this.mergeHeroes(h, tgt); return; }
    // no valid target → snap back to its pad
    const pad = this.padByCell.get(`${h.col},${h.row}`);
    if (pad) { h.x = pad.x; h.y = pad.y; h.snapHome(); }
  }

  /** A hero is a valid merge target for `src` if it's a DIFFERENT hero, same type,
   *  both at max level, the target isn't already at 3 merge tiers, and the cursor
   *  is over it. */
  private mergeTargetUnder(src: Hero, x: number, y: number): Hero | null {
    if (!src.isMaxLevel) return null;
    let best: Hero | null = null, bestD = 34; // must be within ~34px of a hero
    for (const o of this.heroes) {
      if (o === src || !o.isMaxLevel || o.heroId !== src.heroId || o.mergeTiers >= 3) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  /** Merge `src` into `tgt` with CONSERVED value (Clash-Royale style): the source's
   *  full worth carries over. A plain max hero is worth 1 tier; a source already at
   *  N tiers is worth N+1 (itself + the heroes it had absorbed). So +5%(1) into a
   *  plain hero → +10%(2); two +5% heroes → +15%(3). Each tier = +5% damage + 1 gold
   *  shield, capped at 3. src is removed (pad freed). */
  private mergeHeroes(src: Hero, tgt: Hero): void {
    if (!tgt.mergeOnce(src.mergeTiers + 1)) { // target already maxed merges → snap src back
      const pad = this.padByCell.get(`${src.col},${src.row}`);
      if (pad) { src.x = pad.x; src.y = pad.y; src.snapHome(); }
      return;
    }
    this.audio.play(AudioKeys.Merge); // fusion "ping"
    this.mergeFx(tgt.x, tgt.y); // hand-drawn magic conjure (crisp at any scale)
    this.cameras.main.shake(80, 0.004);
    this.removeHero(src); // source consumed; its pad reverts to empty
    this.markTip('merge'); // player discovered merging
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
        // gate cost: real boss 10, elite minion (boss-type) 3, ordinary 1
        const cost = z.bossInfo ? 10 : z.isElite ? 3 : 1;
        this.lives -= cost;
        this.refreshHud();
        this.audio.play(AudioKeys.Lose);
        this.cameras.main.shake(z.bossInfo ? 200 : z.isElite ? 150 : 120, z.bossInfo ? 0.01 : z.isElite ? 0.008 : 0.006);
        if (this.lives <= 0) { this.gameOver(); return; }
      } else if (z.hp <= 0 && !z.dying) {
        // died from a DoT tick this frame (skip if its death anim already started,
        // else it would be "killed" — and rewarded — every frame until it despawns)
        this.killZombie(z);
        continue;
      }
      // real boss hero-kill skill: full slow-mo cinematic, on its own cooldown.
      // (Elite minions do NOT attack heroes — they're just tougher walkers.)
      if (z.bossInfo && this.heroes.length && time >= z.nextHeroKillAt) {
        // khoai/hakj hurl a projectile at a hero (ranged execute — no camera zoom,
        // works fine with a menu open). The Easy boss uses the slow-mo cinematic,
        // falling back to a quick no-cinematic kill if a menu is open.
        if (z.bossInfo.throwTex) {
          this.bossThrowHero(z, z.bossInfo.throwTex);
        } else if (this.heroPicker.visible || this.upgradePanel.visible) {
          this.bossKillHeroQuick(z);
        } else {
          this.bossKillHero(z);
        }
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
        const buff = this.buffAt(h.x, h.y) * h.mergeMult; // merge adds +5%/tier
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
        const mdmg = s.damage * this.buffAt(h.x, h.y) * h.mergeMult;
        if (def.skill === 'cleave') {
          const hits = h.inRange(live, s.range);
          for (const z of hits) this.damageZombie(z, mdmg, h, live, now);
          this.slashFx(h.x, h.y, def.tint);
        } else if (def.skill === 'combo') {
          // xxKingxx: hammer the SAME target for rising bonus damage. The hero
          // tracks a combo counter that grows while she keeps hitting one zombie
          // and resets the instant she switches target (or it dies).
          if (!intent.target) return;
          const mult = h.comboHit(intent.target, def.comboStep ?? 0.25, def.comboMax ?? 5);
          this.damageZombie(intent.target, mdmg * mult, h, live, now);
          this.comboFx(intent.target.x, intent.target.y, def.tint, h.comboCount);
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
      case 'orbit': {
        // Yugitoh: orbs damage every zombie they sweep over. The Hero owns the orb
        // visuals + rotation; here we just tick damage to zombies within orbRadius.
        const odmg = s.damage * this.buffAt(h.x, h.y) * h.mergeMult;
        const r = def.orbRadius ?? 52;
        for (const z of live) {
          if (z.dead || z.dying) continue;
          if (Phaser.Math.Distance.Between(z.x, z.y, h.x, h.y) <= r) {
            this.damageZombie(z, odmg, h, live, now);
          }
        }
        break;
      }
      case 'nova': {
        const ndmg = s.damage * this.buffAt(h.x, h.y) * h.mergeMult;
        if (def.skill === 'quake') {
          // Joicy (Thunder Slam): a club smash sends an EXPANDING shockwave out to
          // quakeRadius — every zombie it sweeps is damaged, knocked back, and
          // briefly stunned. Bigger reach + heavier feedback than a plain nova.
          const qr = s.quakeRadius ?? def.quakeRadius ?? 120;
          this.quakeFx(h.x, h.y, qr, def.tint);
          this.audio.play(AudioKeys.Explode);
          this.cameras.main.shake(140, 0.008);
          for (const z of h.inRange(live, qr)) {
            this.damageZombie(z, ndmg, h, live, now);
            // Knockback honors a ~1.2s immunity window so stacked Joicys can't
            // chain-shove + stun-lock a zombie forever. The slam still damages every
            // time; it only pushes + stuns when the zombie is out of its KB cooldown.
            if (z.knockBack(def.knockback ?? 30, now, Tuning.quakeKbImmuneMs))
              z.applyStun(def.stunDuration ?? 0.8, now);
          }
          break;
        }
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
      case 'midas': {
        // Hudong (Golden Touch): a chance per hit to GOLDIFY the target. If the
        // zombie is wounded (at/below the threshold) it instantly turns to gold —
        // an instant kill that drops a pile of bonus gold. Otherwise: normal hit.
        const frac = hit.maxHp > 0 ? hit.hp / hit.maxHp : 1;
        if (Math.random() < (def.goldifyChance ?? 0.18) && frac <= (def.goldifyThreshold ?? 0.5)) {
          this.goldifyFx(hit.x, hit.y);
          this.gold += def.goldDrop ?? 14; // bonus on top of the kill bounty
          hit.applyDamage(hit.hp + 1); // ensure lethal
          if (hit.hp <= 0) this.killZombie(hit);
        } else {
          this.damageZombie(hit, pr.damage, null, live, now);
        }
        break;
      }
      case 'freeze': {
        // Morgan Le Fay (Deep Freeze): every hit lands frost damage AND a freeze
        // stack. Enough stacks HARD-FREEZE the zombie (full stop). A frozen zombie
        // is brittle — it takes bonus (brittle) damage from this hit.
        const wasFrozen = hit.isFrozen(now);
        const dmg = wasFrozen ? pr.damage * (def.brittleMul ?? 2) : pr.damage;
        if (wasFrozen) this.iceShatterFx(hit.x, hit.y);
        this.damageZombie(hit, dmg, null, live, now);
        if (!hit.dead && !hit.dying) {
          hit.addFreezeStack(def.freezeStacksToFreeze ?? 3, def.freezeDuration ?? 1.8, now);
        }
        break;
      }
      case 'burn': {
        // xxKongxx (Flame Breathing): hit damage + a BURN stack. At the stack
        // threshold the zombie incinerates (%-HP/tick). The flame also SPREADS a
        // weaker burn to nearby zombies so a packed lane all catches fire.
        this.damageZombie(hit, pr.damage, null, live, now);
        const dps = pr.tier.burnDps ?? def.burnDps ?? 8;
        const stacks = pr.tier.burnStacksToIncinerate ?? def.burnStacksToIncinerate ?? 5;
        const incin = pr.tier.incinPctPerTick ?? def.incinPctPerTick ?? 0.04;
        const dur = def.burnDuration ?? 3;
        // a flaming sword-slash arc on the strike (random tilt so swings vary)
        this.playFxAnim('fx-slash', hit.x, hit.y, 0.7, Phaser.Math.Between(-35, 35), 0xff8a3a);
        if (!hit.dead && !hit.dying) {
          const ignited = hit.applyBurn(dps, dur, stacks, incin, now);
          this.flameFx(hit.x, hit.y, ignited);
          // a bigger fireball burst at the moment of ignition
          if (ignited) this.playFxAnim('fx-fireball', hit.x, hit.y, 1.1);
        }
        // spread a single burn stack to neighbours within the spread radius
        const sr = def.burnSpreadRadius ?? 40;
        for (const z of live) {
          if (z === hit || z.dead || z.dying) continue;
          if (Math.hypot(z.x - hit.x, z.y - hit.y) <= sr) {
            z.applyBurn(dps, dur, stacks, incin, now);
            this.flameFx(z.x, z.y, false);
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
        // HAKJ: an ICE splash — small AoE damage + a brief slow on the cluster,
        // with a cyan ice-crystal burst (scaled to the splash radius).
        const r = def.splashRadius ?? 40;
        this.playFxAnim('fx-ice', pr.x, pr.y, (r * 2) / 72 * 1.1);
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
      case 'multishot': {
        // Oreo: shuriken strike — a quick white slash spark per hit (long range now).
        this.damageZombie(hit, pr.damage, null, live, now);
        this.playFxAnim('fx-slash', hit.x, hit.y, 0.5, Phaser.Math.Between(0, 359), 0xffffff);
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
  // Uses the hero's PER-TIER buffMul so the aura scales as the buffer is upgraded.
  private buffAt(x: number, y: number): number {
    let mul = 1;
    for (const h of this.heroes) {
      if (h.def.skill !== 'buffaura') continue;
      if (Phaser.Math.Distance.Between(x, y, h.x, h.y) > h.stats.range) continue;
      // buffPerLevel = exact +x%/level (1 + p*(tier+1)); else tier/def buffMul
      const m = h.def.buffPerLevel != null
        ? 1 + h.def.buffPerLevel * (h.tier + 1)
        : (h.stats.buffMul ?? h.def.buffMul ?? 1.25);
      mul *= m;
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
    this.kills++; this.goldEarned += reward; // leaderboard metadata
    this.refreshHud();
    this.shatter(z.x, z.y); // chunks burst apart (no explosion flash)
    // death sound only (no Explode — it was the "drum" stacking on mass kills).
    this.audio.play(Math.random() < 0.5 ? AudioKeys.ZombieDie : AudioKeys.ZombieDie2);
    z.playDeath(); // topple + fade, then despawns itself (gold already awarded)
  }

  /** Pick the boss's victim: FOCUS merged heroes first (gold shields to break),
   *  else the nearest ordinary hero within reach. Null if nothing is close enough. */
  private pickBossVictim(boss: Zombie, reach = 150): Hero | null {
    const REACH = reach;
    const pick = (onlyMerged: boolean): Hero | null => {
      let t: Hero | null = null, best = REACH;
      for (const h of this.heroes) {
        if (onlyMerged && !h.hasShield) continue;
        const d = Math.hypot(h.x - boss.x, h.y - boss.y);
        if (d < best) { best = d; t = h; }
      }
      return t;
    };
    return pick(true) ?? pick(false);
  }

  /** Deliver the kill blow on a victim (beam + boom + shake + sound). A gold shield
   *  from merging absorbs it (hero survives, loses a tier); otherwise the hero dies. */
  private bossKillBlow(boss: Zombie, victim: Hero): void {
    const g = this.add.graphics().setDepth(20);
    g.lineStyle(4, 0xff2a2a, 0.95).lineBetween(boss.x, boss.y, victim.x, victim.y);
    g.fillStyle(0xff2a2a, 0.5).fillCircle(victim.x, victim.y, 26);
    this.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });
    this.boom(victim.x, victim.y, 0.8);
    this.cameras.main.shake(200, 0.01);
    this.audio.play(AudioKeys.Push);
    if (victim.consumeShield()) return; // shielded → survives
    this.removeHero(victim);
  }

  /** Quick, no-cinematic hero kill — used when a menu is open so we don't zoom the
   *  camera (and warp/close the UI). The boss still claims its victim instantly. */
  private bossKillHeroQuick(boss: Zombie): void {
    const victim = this.pickBossVictim(boss);
    if (!victim) return;
    boss.playBossAttack();
    this.bossKillBlow(boss, victim);
  }

  /** Ranged boss execute: King Khoai hurls a potato, Hakj a fish-bone spear at a
   *  hero from across the field. The projectile spins/flies to the target and
   *  delivers the kill blow on arrival (a gold shield still absorbs it). No camera
   *  zoom, so it's safe with a menu open. */
  private bossThrowHero(boss: Zombie, tex: string): void {
    const victim = this.pickBossVictim(boss, 9999); // ranged — reach the whole field
    if (!victim) return;
    boss.playBossAttack();
    const tx = victim.x, ty = victim.y; // capture target pos at throw time
    const angle = Math.atan2(ty - boss.y, tx - boss.x);
    const proj = this.add.image(boss.x, boss.y - 10, tex).setDepth(21).setRotation(angle);
    // scale potato/spear to a sensible size (potato small, spear longer)
    const targetH = tex === TextureKeys.FxPotato ? 16 : 18;
    proj.setScale(targetH / (proj.height || targetH));
    const dist = Math.hypot(tx - boss.x, ty - (boss.y - 10));
    this.tweens.add({
      targets: proj, x: tx, y: ty, rotation: angle + (tex === TextureKeys.FxPotato ? Math.PI * 4 : 0),
      duration: Phaser.Math.Clamp(dist * 1.4, 260, 700), ease: 'Quad.easeIn',
      onComplete: () => {
        proj.destroy();
        if (!victim.active) return; // hero already gone
        this.bossKillBlow(boss, victim);
      },
    });
  }

  /** Boss special — a tense cinematic: pick the nearest hero, SLOW the whole scene
   *  to a crawl for 3s, lock a red targeting reticle onto the doomed hero (camera
   *  eases toward it), then snap back to full speed and execute it. */
  private bossKillHero(boss: Zombie): void {
    if (this.cinematicActive) return; // one execution cinematic at a time
    const victim = this.pickBossVictim(boss);
    if (!victim) return;
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
      this.bossKillBlow(boss, victim); // red beam + boom + shake, then shield/kill
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
    if (this.runStartedAt === 0) this.runStartedAt = Date.now(); // clock starts at wave 1
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
      // elite minion (a lower boss walking in the wave) on harder maps, mid/late waves
      if (elite.length && this.wave >= 7 && r < 0.15) q.push(Phaser.Utils.Array.GetRandom(elite));
      else if (this.wave >= 4 && pool.includes('chainsaw') && r < 0.32) q.push('chainsaw'); // fast aggressor
      else if (this.wave >= 6 && pool.includes('brute') && r < 0.5) q.push('brute');
      else if (this.wave >= 3 && pool.includes('slow') && r < 0.68) q.push('slow');
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
      // khoai/hakj execute heroes by THROWING a projectile (ranged); the Easy boss
      // keeps the slow-mo melee cinematic. (Copy so we never mutate the shared def.)
      const throwTex = id === 'khoai' ? TextureKeys.FxPotato : id === 'hakj' ? TextureKeys.FxBoneSpear : undefined;
      z.bossInfo = { ...def.boss, throwTex };
      z.nextHeroKillAt = this.time.now + def.boss.skillCdMs;
    } else if (def.boss) {
      z.isElite = true; // boss-type spawned as a minion → tougher, costs 3 at the gate (no hero-kill)
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

  // Hudong's GOLDIFY: a gold flash + a fountain of coin-sparks and a "$" pop.
  private goldifyFx(x: number, y: number): void {
    const flash = this.add.circle(x, y, 10, 0xffd23f, 0.9).setDepth(14);
    this.tweens.add({ targets: flash, radius: 30, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8 + Phaser.Math.FloatBetween(-0.3, 0.3);
      const coin = this.add.circle(x, y, 3, 0xffe066, 1).setStrokeStyle(1, 0x7a5a00).setDepth(15);
      const sp = Phaser.Math.FloatBetween(40, 80);
      this.tweens.add({
        targets: coin, x: x + Math.cos(ang) * sp, y: y + Math.sin(ang) * sp - 30, alpha: 0,
        duration: Phaser.Math.Between(360, 540), ease: 'Quad.easeIn', onComplete: () => coin.destroy(),
      });
    }
    const t = this.add.text(x, y - 12, '$$$', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd23f', stroke: '#7a5a00', strokeThickness: 4 }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 600, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  // Morgan's ICE SHATTER: jagged cyan shards burst out when a frozen zombie is hit.
  private iceShatterFx(x: number, y: number): void {
    const ring = this.add.circle(x, y, 6, 0x9bd6ff, 0.5).setDepth(13);
    this.tweens.add({ targets: ring, radius: 22, alpha: 0, duration: 220, onComplete: () => ring.destroy() });
    for (let i = 0; i < 7; i++) {
      const ang = (Math.PI * 2 * i) / 7 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const sp = Phaser.Math.FloatBetween(45, 90);
      const shard = this.add.triangle(x, y, 0, 0, 4, 10, -4, 10, 0xd6f1ff, 0.95)
        .setStrokeStyle(1, 0x4aa6e6).setDepth(15).setAngle(Phaser.Math.Between(0, 360));
      this.tweens.add({
        targets: shard, x: x + Math.cos(ang) * sp, y: y + Math.sin(ang) * sp, alpha: 0,
        angle: shard.angle + Phaser.Math.Between(-180, 180), duration: Phaser.Math.Between(300, 460),
        ease: 'Quad.easeIn', onComplete: () => shard.destroy(),
      });
    }
  }

  // xxKingxx's COMBO: a slash plus a rising combo counter once the chain is going.
  private comboFx(x: number, y: number, hex: string, count: number): void {
    this.slashFx(x, y, hex);
    if (count >= 1) {
      const t = this.add.text(x, y - 16, `x${count + 1}`, { fontFamily: 'monospace', fontSize: `${10 + Math.min(count, 5)}px`, color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 3 }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: t, y: y - 30, alpha: 0, scale: 1.3, duration: 420, ease: 'Quad.out', onComplete: () => t.destroy() });
    }
  }

  /** Play a one-shot FX spritesheet animation at (x,y), then destroy it. `scale`
   *  sizes it; `angle` rotates (slash arcs); `tint` optional recolour. */
  private playFxAnim(key: string, x: number, y: number, scale = 1, angle = 0, tint?: number): void {
    const tex: Record<string, string> = {
      'fx-slash': TextureKeys.FxSlash, 'fx-fireball': TextureKeys.FxFireball,
      'fx-ice': TextureKeys.FxIce,
    };
    const spr = this.add.sprite(x, y, tex[key] ?? TextureKeys.FxFireball)
      .setDepth(16).setScale(scale).setAngle(angle).setBlendMode(Phaser.BlendModes.ADD);
    if (tint !== undefined) spr.setTint(tint);
    spr.play(key);
    spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.destroy());
  }

  // xxKongxx's FLAME: little fire tongues rising off a burning zombie. `ignite`
  // marks the moment it incinerates — a bigger orange flare + brief upscale.
  private flameFx(x: number, y: number, ignite: boolean): void {
    const n = ignite ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const fx = x + Phaser.Math.Between(-6, 6);
      const tongue = this.add.circle(fx, y, ignite ? 4 : 3, i % 2 ? 0xffd23f : 0xff6b1a, 0.95).setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: tongue, y: y - Phaser.Math.Between(16, 30), alpha: 0, scale: 0.2,
        duration: Phaser.Math.Between(300, 520), ease: 'Quad.easeOut', onComplete: () => tongue.destroy(),
      });
    }
    if (ignite) {
      const flare = this.add.circle(x, y, 12, 0xff8c1a, 0.6).setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flare, radius: 30, alpha: 0, duration: 360, ease: 'Quad.easeOut', onComplete: () => flare.destroy() });
    }
  }

  // Joicy's THUNDER SLAM: a pretty purple shockwave. Several concentric rings ripple
  // outward in a quick stagger, each growing from a tiny dot to the FULL quake radius
  // `r` and thinning/fading as it goes, so it reads as a wave rolling out. A soft
  // purple fill + a white core sell the impact. Rings are scaled (not radius-tweened)
  // so the stroke stays crisp under Phaser 4 WebGL.
  private quakeFx(x: number, y: number, r: number, hex: string): void {
    const purple = Phaser.Display.Color.HexStringToColor(hex || '#c45ce0').color;
    const light = 0xe0a8ff; // lighter violet for the leading ring
    const BASE = 12; // dot radius the rings start from; we scale up to r/BASE

    // soft purple shockfront fill that swells out and fades
    const fill = this.add.circle(x, y, BASE, purple, 0.28).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: fill, scale: r / BASE, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => fill.destroy() });

    // 3 staggered ripple rings, each from a dot out to the full radius
    const rings = [
      { col: light, w: 4, delay: 0, dur: 460, a: 0.95 },
      { col: purple, w: 6, delay: 70, dur: 520, a: 0.9 },
      { col: purple, w: 3, delay: 150, dur: 560, a: 0.7 },
    ];
    for (const cfg of rings) {
      const ring = this.add.circle(x, y, BASE, 0x000000, 0).setStrokeStyle(cfg.w, cfg.col, cfg.a).setDepth(13).setScale(0.15);
      this.tweens.add({
        targets: ring, scale: r / BASE, alpha: 0, delay: cfg.delay, duration: cfg.dur,
        ease: 'Cubic.easeOut', onComplete: () => ring.destroy(),
      });
    }

    // bright core pop at the slam point
    const core = this.add.circle(x, y, 14, 0xffffff, 0.85).setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: core, scale: 2.2, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => core.destroy() });

    // a few purple shards kicked up along the wavefront for extra "oomph"
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const shard = this.add.circle(x, y, 3, light, 0.9).setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: shard, x: x + Math.cos(ang) * r * 0.9, y: y + Math.sin(ang) * r * 0.9, alpha: 0, scale: 0.3,
        duration: Phaser.Math.Between(380, 520), ease: 'Quad.easeOut', onComplete: () => shard.destroy(),
      });
    }
  }

  /** Hand-drawn HERO-MERGE conjure FX (no spritesheet — vector graphics + tweens,
   *  so it's always crisp and never warps). A gold magic rune-circle draws itself
   *  at the hero's feet (two counter-rotating ringed rune wheels), gold sparks fly
   *  INWARD to fuse, a white→gold core flashes, and a soft column of light rises. */
  private mergeFx(x: number, y: number): void {
    const GOLD = 0xffd23f, AMBER = 0xff9b2f, WHITE = 0xffffff;
    const fy = y + 10; // the magic circle sits at the feet

    // ── 1. ground rune-circle: a Graphics wheel (outer ring + inner ring + ticks +
    //    rune triangles). Drawn flattened (scaleY 0.42) so it reads as on-ground.
    const makeWheel = (radius: number, ticks: number, col: number, lw: number) => {
      const g = this.add.graphics().setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(lw, col, 0.95);
      g.strokeCircle(0, 0, radius);
      g.strokeCircle(0, 0, radius * 0.66);
      for (let i = 0; i < ticks; i++) {
        const a = (Math.PI * 2 * i) / ticks;
        g.lineBetween(Math.cos(a) * radius * 0.66, Math.sin(a) * radius * 0.66, Math.cos(a) * radius, Math.sin(a) * radius);
      }
      g.setPosition(x, fy).setScale(0.2, 0.2 * 0.42).setAlpha(0);
      return g;
    };
    const outer = makeWheel(40, 12, GOLD, 2.5);
    const inner = makeWheel(26, 6, AMBER, 2);
    // fade/scale in, hold spinning, then fade out — counter-rotating
    this.tweens.add({ targets: outer, scaleX: 1, scaleY: 0.42, alpha: { from: 0, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: outer, angle: 90, duration: 700, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: outer, alpha: 0, delay: 460, duration: 260, onComplete: () => outer.destroy() });
    this.tweens.add({ targets: inner, scaleX: 1, scaleY: 0.42, alpha: { from: 0, to: 1 }, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: inner, angle: -120, duration: 700, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: inner, alpha: 0, delay: 460, duration: 260, onComplete: () => inner.destroy() });

    // ── 2. convergence sparks: gold motes spiral INWARD to the hero (the "fuse").
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const r0 = 46;
      const sx = x + Math.cos(a) * r0, sy = fy + Math.sin(a) * r0 * 0.5;
      const mote = this.add.circle(sx, sy, 3, i % 2 ? GOLD : WHITE, 1).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: mote, x, y: y - 4, scale: 0.2, alpha: { from: 1, to: 0.4 },
        delay: i * 12, duration: 300, ease: 'Quad.easeIn', onComplete: () => mote.destroy(),
      });
    }

    // ── 3. core flash: white burst → gold, right after the sparks converge.
    this.time.delayedCall(280, () => {
      const core = this.add.circle(x, y - 2, 10, WHITE, 0.95).setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: core, scale: 3, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
      // a single clean ring pulse outward
      const ring = this.add.circle(x, y - 2, 8, 0, 0).setStrokeStyle(3, GOLD, 0.9).setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    });

    // ── 4. rising light column: a tall thin glow that shoots up + fades (power-up).
    const col = this.add.rectangle(x, y, 16, 54, GOLD, 0.5).setOrigin(0.5, 1).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    col.setScale(0.4, 0.2);
    this.tweens.add({ targets: col, scaleX: 1, scaleY: 1.3, alpha: 0, y: y - 6, delay: 240, duration: 380, ease: 'Quad.easeOut', onComplete: () => col.destroy() });
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

    // "?" help button — top-right of the play field; reopens How to Play any time.
    const hb = this.add.circle(GAME_WIDTH - 20, 20, 14, 0x1c1730, 0.9).setStrokeStyle(2, 0xffd23f).setDepth(50).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH - 20, 20, '?', { fontFamily: Fonts.Display, fontSize: '20px', color: '#ffd23f' }).setOrigin(0.5).setDepth(51);
    hb.on('pointerup', () => {
      if (this.heroPicker.visible || this.upgradePanel.visible || this.cinematicActive) return;
      this.audio.play(AudioKeys.Click);
      this.showTutorial();
    });
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
    this.heroPicker.add(dim);

    // ── LEFT: hero list (2 columns of avatar tiles) — SCROLLABLE ──
    // The roster keeps growing (28 heroes → 14 rows), which overflows the 800px
    // screen. So the tiles live in a `listPane` container we scroll vertically
    // (drag or wheel); the header / detail / close are added AFTER it so they draw
    // on top and hide any tiles that scroll past the top edge (Phaser 4 WebGL has
    // no geometry masks — draw-order is the clip).
    const listX = 10, listY = 44, tileW = 74, tileH = 56, cols = 2;
    this.listScrollTop = 0;
    this.listPane = this.add.container(0, this.listScrollTop);
    this.heroPicker.add(this.listPane);
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
      hit.on('pointerup', (p: Phaser.Input.Pointer) => { if (!this.listDragged) this.previewHero(id, p); });
      this.listHighlights.set(id, hl);
      this.listPane.add([cell, hl, icon, name, hit]);
    });
    // scroll bounds: how far up the pane can slide so the last row sits on-screen.
    const rows = Math.ceil(HERO_IDS.length / cols);
    const listBottom = listY + rows * tileH;        // content height (px)
    const visibleBottom = GAME_HEIGHT - 8;          // keep an 8px breathing gap
    this.listScrollMin = Math.min(0, visibleBottom - listBottom);
    this.installListScroll(listX, tileW * cols);

    // ── header strip + scroll hints (drawn AFTER the list so they sit on top and
    //    mask tiles scrolling under them) ──
    const listColW = tileW * cols;
    // opaque strip behind the title so tiles scrolling up vanish under it
    this.heroPicker.add(this.add.rectangle(listX - 4, 0, listColW + 8, 38, 0x0a0a14, 1).setOrigin(0, 0));
    this.heroPicker.add(this.add.text(listX + listColW / 2, 18, 'CHOOSE A HERO', {
      fontFamily: 'monospace', fontSize: '14px', color: '#a7f070',
    }).setOrigin(0.5));
    // up / down chevrons — shown only when there's more list off-screen that way
    const arrowX = listX + listColW / 2;
    this.listArrowUp = this.add.text(arrowX, 40, '▲', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd23f' }).setOrigin(0.5).setVisible(false);
    this.listArrowDown = this.add.text(arrowX, GAME_HEIGHT - 12, '▼ more', { fontFamily: 'monospace', fontSize: '12px', color: '#ffd23f' }).setOrigin(0.5).setVisible(false);
    this.heroPicker.add([this.listArrowUp, this.listArrowDown]);
    this.tweens.add({ targets: this.listArrowDown, y: GAME_HEIGHT - 8, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: this.listArrowUp, y: 44, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.updateListArrows();

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

  /** Make the hero LIST column scroll vertically (drag or mouse-wheel). Only acts
   *  while the picker is open and the pointer is over the list column, so it never
   *  fights with the detail pane / field input. `colX`/`colW` bound the hit area. */
  private installListScroll(colX: number, colW: number): void {
    const clamp = (y: number) => Phaser.Math.Clamp(y, this.listScrollMin, this.listScrollTop);
    const overList = (p: Phaser.Input.Pointer) =>
      this.heroPicker.visible && p.x >= colX - 4 && p.x <= colX + colW + 4;

    // drag-to-scroll
    let dragging = false, lastY = 0, downY = 0;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (!overList(p)) return;
      dragging = true; lastY = p.y; downY = p.y; this.listDragged = false;
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      this.listPane.y = clamp(this.listPane.y + (p.y - lastY));
      lastY = p.y;
      if (Math.abs(p.y - downY) > 6) this.listDragged = true; // a real drag → suppress the tap-select
      this.updateListArrows();
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => { dragging = false; });

    // mouse-wheel scroll
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!overList(p)) return;
      this.listPane.y = clamp(this.listPane.y - dy * 0.5);
      this.updateListArrows();
    });
  }

  /** Show the up/down "more heroes" chevrons only when the list can scroll that way. */
  private updateListArrows(): void {
    if (!this.listArrowUp || !this.listArrowDown) return;
    const y = this.listPane.y;
    this.listArrowUp.setVisible(y < this.listScrollTop - 1);   // scrolled down → more above
    this.listArrowDown.setVisible(y > this.listScrollMin + 1); // room to scroll → more below
  }

  private openHeroPicker(padKey: string, pointerId = -1): void {
    this.clearSelection();
    this.selectedPadKey = padKey;
    this.pickerOpenedBy = pointerId; // swallow this tap's pointerup (see isOpeningTap)
    this.showStartBtn(false);
    this.listPane.y = this.listScrollTop; // always open scrolled to the top
    this.listDragged = false;
    this.heroPicker.setVisible(true);
    this.updateListArrows(); // refresh the scroll-hint chevrons
    // pre-select the player's last-picked hero (defaults to Oreo on first open) so
    // the detail pane isn't empty and the choice is predictable, not random.
    this.selectHeroInPicker(this.lastPickedHero);
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
    this.lastPickedHero = id; // remember so the next picker open pre-selects it
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
          this.maybeHintMerge(); // just hit max? two max same-type → suggest merging
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
    this.submitRun('overrun');
    this.endOverlay(`OVERRUN\nWave ${this.wave}\nTAP TO RETRY`, '#ff6b6b');
  }
  private win(): void {
    if (this.over) return;
    this.over = true;
    this.saveBest();
    this.submitRun('win');
    // mark this map cleared → unlocks the next one in MapSelect (registry + localStorage)
    this.registry.set(mapClearedKey(this.map.id), true);
    Storage.setCleared(this.map.id);
    const last = this.map.id >= MAP_COUNT - 1;
    const msg = last
      ? 'ALL MAPS CLEARED!\nYou are the champion\nTAP TO CONTINUE'
      : `VICTORY!\n${this.map.name} cleared\nNext map unlocked!\nTAP TO CONTINUE`;
    this.endOverlay(msg, '#a7f070');
  }
  /** Send the finished run to the leaderboard backend (once). No-op + fail-safe when
   *  the API is disabled or offline — never blocks the game-over flow. */
  private submitRun(outcome: 'win' | 'overrun'): void {
    if (this.runSubmitted || this.runStartedAt === 0) return; // never started a wave
    this.runSubmitted = true;
    void Api.submitRun({
      mapId: this.map.id, wave: this.wave, outcome,
      startedAt: this.runStartedAt, endedAt: Date.now(),
      heroesPlaced: this.heroesPlaced, kills: this.kills, goldEarned: this.goldEarned,
    });
  }
  private saveBest(): void {
    const key = mapBestKey(this.map.id);
    const best = (this.registry.get(key) as number) ?? 0;
    if (this.wave > best) this.registry.set(key, this.wave);
    Storage.setBest(this.map.id, this.wave); // mirror to localStorage (survives reload)
  }
  // ── tutorial / tips ────────────────────────────────────────────────────────────
  /** Paged "How to Play" carousel: one mechanic per page with an icon + short text,
   *  dot indicators, and Prev/Next/Skip. Shown once on first run (persisted via
   *  TipsSeen) and re-openable any time via the HUD "?" button. */
  private showTutorial(): void {
    const T = TextureKeys;
    // each page: an emoji-ish icon source (a texture key, or null = draw a glyph),
    // a fallback glyph, a colour, a title and 1–2 short lines.
    const pages: Array<{ tex: string | null; glyph: string; col: string; title: string; lines: string[] }> = [
      { tex: T.Pad, glyph: '🟦', col: '#5ad1ff', title: 'PLACE HEROES',
        lines: ['Tap a glowing PAD to open the', 'hero list, then PLACE a hero on it.'] },
      { tex: null, glyph: '▶', col: '#a7f070', title: 'START THE WAVE',
        lines: ['Press START WAVE to send the', 'zombies in. Survive every wave!'] },
      { tex: T.HeroOreo, glyph: '⬆', col: '#ffe066', title: 'UPGRADE & SELL',
        lines: ['Tap a hero to UPGRADE it (max Lv10),', 'or SELL it to refund 60% of its cost.'] },
      { tex: T.HeroHakj, glyph: '✨', col: '#ffd23f', title: 'MERGE FOR POWER',
        lines: ['Drag a MAX-LEVEL hero onto another of', 'the SAME type: +5% damage + a gold', 'shield that blocks one boss hit (max 3).'] },
      { tex: T.ZombieBossStand, glyph: '👑', col: '#ff5d5d', title: 'BEWARE THE BOSS',
        lines: ['Bosses can execute your heroes — and', 'one reaching the gate costs 10 lives!'] },
    ];

    const root = this.add.container(0, 0).setDepth(98);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05060a, 0.84).setOrigin(0).setInteractive();
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT * 0.42;
    const card = this.add.rectangle(cx, cy, GAME_WIDTH - 56, 320, 0x1c1730, 0.98).setStrokeStyle(3, 0xff3b30);
    const header = this.add.text(cx, cy - 132, 'HOW TO PLAY', {
      fontFamily: Fonts.Display, fontSize: '26px', color: '#ff3b30', stroke: '#1a1c2c', strokeThickness: 5,
    }).setOrigin(0.5);
    root.add([dim, card, header]);

    // page content holders (rebuilt each page)
    const iconImg = this.add.image(cx, cy - 56, T.Pad).setDepth(99);
    const iconGlyph = this.add.text(cx, cy - 56, '', { fontFamily: Fonts.Display, fontSize: '46px', color: '#fff' }).setOrigin(0.5);
    const pTitle = this.add.text(cx, cy - 8, '', { fontFamily: Fonts.Display, fontSize: '22px', color: '#fff', stroke: '#1a1c2c', strokeThickness: 4 }).setOrigin(0.5);
    const pBody = this.add.text(cx, cy + 46, '', { fontFamily: 'monospace', fontSize: '12px', color: '#e8dcff', align: 'center', lineSpacing: 6 }).setOrigin(0.5);
    root.add([iconImg, iconGlyph, pTitle, pBody]);

    // dot indicators
    const dots: Phaser.GameObjects.Arc[] = [];
    const dotY = cy + 104, dotGap = 16, dotX0 = cx - ((pages.length - 1) * dotGap) / 2;
    for (let i = 0; i < pages.length; i++) {
      const d = this.add.circle(dotX0 + i * dotGap, dotY, 4, 0x6a5a8a).setDepth(99);
      dots.push(d); root.add(d);
    }

    // nav buttons
    const mkBtn = (x: number, label: string, bg: string, fg: string) =>
      this.add.text(x, cy + 138, label, {
        fontFamily: Fonts.Display, fontSize: '18px', color: fg, stroke: '#1a1c2c', strokeThickness: 4,
        backgroundColor: bg, padding: { x: 14, y: 5 },
      }).setOrigin(0.5).setDepth(99).setInteractive({ useHandCursor: true });
    const prevBtn = mkBtn(cx - 92, 'BACK', '#2a2038', '#cdd6e6');
    const nextBtn = mkBtn(cx + 78, 'NEXT', '#c0241a', '#ffffff');
    // SKIP sits INSIDE the card's top-right corner (card right edge = cx + (W-56)/2).
    const cardRight = cx + (GAME_WIDTH - 56) / 2;
    const skip = this.add.text(cardRight - 12, cy - 145, 'SKIP ✕', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8a7aa6',
    }).setOrigin(1, 0.5).setDepth(99).setInteractive({ useHandCursor: true });
    root.add([prevBtn, nextBtn, skip]);
    this.tweens.add({ targets: nextBtn, scale: 1.06, duration: 600, yoyo: true, repeat: -1 });

    let page = 0;
    const render = () => {
      const p = pages[page];
      if (p.tex && this.textures.exists(p.tex)) {
        iconImg.setVisible(true).setTexture(p.tex);
        const src = iconImg.height || 48; iconImg.setScale(52 / src);
        iconGlyph.setVisible(false);
      } else {
        iconImg.setVisible(false);
        iconGlyph.setVisible(true).setText(p.glyph).setColor(p.col);
      }
      pTitle.setText(p.title).setColor(p.col);
      pBody.setText(p.lines.join('\n'));
      for (let i = 0; i < dots.length; i++) dots[i].setFillStyle(i === page ? 0xffd23f : 0x6a5a8a).setScale(i === page ? 1.3 : 1);
      prevBtn.setVisible(page > 0);
      (nextBtn as Phaser.GameObjects.Text).setText(page === pages.length - 1 ? 'PLAY ▶' : 'NEXT');
    };
    this.tutorialOpen = true; // modal — block field taps underneath
    const finish = () => { this.tutorialOpen = false; this.registry.set(RegistryKeys.TipsSeen, true); root.destroy(); };
    nextBtn.on('pointerup', () => { if (page < pages.length - 1) { page++; render(); } else finish(); });
    prevBtn.on('pointerup', () => { if (page > 0) { page--; render(); } });
    skip.on('pointerup', finish);
    render();
  }

  /** Contextual one-time hints: a small toast that teaches a mechanic the moment it
   *  becomes relevant. `key` is the RegistryKey persisting "already shown". */
  private markTip(key: string): void {
    let regKey: string | null = null, msg = '';
    if (key === 'pad') { regKey = RegistryKeys.HintPadSeen; msg = '👆 Tap a glowing PAD to place a hero'; }
    else if (key === 'merge') { regKey = RegistryKeys.HintMergeSeen; msg = '✨ Drag a max-level hero onto a same-type one to MERGE'; }
    if (!regKey || this.registry.get(regKey)) return; // unknown or already shown
    this.registry.set(regKey, true);
    this.showToast(msg);
  }

  /** If there are ≥2 max-level heroes of the SAME type (a valid merge pair), show
   *  the one-time merge hint. Called after an upgrade so it fires the moment merging
   *  first becomes possible. */
  private maybeHintMerge(): void {
    if (this.registry.get(RegistryKeys.HintMergeSeen)) return;
    const maxByType = new Map<string, number>();
    for (const h of this.heroes) {
      if (!h.isMaxLevel) continue;
      const n = (maxByType.get(h.heroId) ?? 0) + 1;
      maxByType.set(h.heroId, n);
      if (n >= 2) { this.markTip('merge'); return; }
    }
  }

  /** A small auto-dismissing hint banner near the bottom of the field. */
  private showToast(msg: string): void {
    const y = FIELD_H - 40;
    const t = this.add.text(GAME_WIDTH / 2, y, msg, {
      fontFamily: 'monospace', fontSize: '12px', color: '#1a1c2c', align: 'center',
      backgroundColor: '#ffe066', padding: { x: 12, y: 7 }, wordWrap: { width: GAME_WIDTH - 60 },
    }).setOrigin(0.5).setDepth(80).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: y - 8, duration: 240, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, y: y - 20, delay: 3200, duration: 400, onComplete: () => t.destroy() });
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
