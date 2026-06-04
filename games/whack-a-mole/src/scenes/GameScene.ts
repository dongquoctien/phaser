import Phaser from 'phaser';
import { SceneKeys, TexKeys, AtlasKeys, AudioKeys, REG_WEAPON, type WeaponId } from '../types/keys';
import { WEAPON_ORIGIN, WEAPON_TEX } from '../systems/art';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Hole } from '../objects/Hole';
import { pickChar, rollRoster, type CharDef, type Roster } from '../systems/roster';
import { Audio } from '../systems/Audio';
import { Storage } from '../systems/Storage';
import { Api } from '../systems/Api';
import { showLeaderboard } from '../systems/LeaderboardPanel';

declare const __DEV__: boolean;

// Core loop: characters pop from a 3x3 hole grid for a brief window — tap the
// enemies before they duck to score combo points, but DON'T whack the friendly
// ones (capybara, alpaca, teddy, blob) or you lose your combo and points.
// 60-second timed run; whack as many as you can.

const ROUND_SECONDS = 60;
const GRID_COLS = 3;
const GRID_ROWS = 3;

const ENEMY_POINTS = 10;
const BOSS_POINTS = 30;
const FRIENDLY_PENALTY = 15;

export class GameScene extends Phaser.Scene {
  private holes: Hole[] = [];
  private rng!: Phaser.Math.RandomDataGenerator;
  private roster!: Roster; // re-rolled each fresh round
  private lastFrame?: string; // last spawned character, to avoid repeats

  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  // per-character tally of successful bonks (enemy/boss frame -> count) for the
  // end-of-round breakdown report.
  private whackCounts = new Map<string, number>();
  private friendlyHits = 0; // how many "spare" characters got wrongly bonked
  private timeLeft = ROUND_SECONDS;
  private elapsed = 0; // seconds since start (drives difficulty)
  private running = false;

  private spawnTimer = 0;
  private spawnInterval = 900; // ms, shrinks over time

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private timeBar!: Phaser.GameObjects.Graphics;
  private mallet!: Phaser.GameObjects.Image;
  // mallet follows the pointer at (malletX,malletY); the swing animates a
  // vertical offset + lift so it reads as raising up then slamming DOWN, instead
  // of just rotating left/right.
  private malletX = GAME_WIDTH / 2;
  private malletY = GAME_HEIGHT / 2;
  private swing = { lift: 0 }; // px: positive = head raised UP (toward screen)
  private dirtEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private starEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private frozenUntil = 0; // hit-stop guard (ms timestamp)
  private audio!: Audio;
  private roundStartedAt = 0; // ms epoch when the round began (for the leaderboard)
  private submitted = false;  // guard: submit the run to the leaderboard only once

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.rng = new Phaser.Math.RandomDataGenerator([String(this.time.now)]);
    this.roster = rollRoster(this.rng); // fresh cast of roles this round
    this.lastFrame = undefined;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.whackCounts = new Map();
    this.friendlyHits = 0;
    this.timeLeft = ROUND_SECONDS;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 900;
    this.frozenUntil = 0;
    this.running = true;
    this.roundStartedAt = Date.now();
    this.submitted = false;

    this.audio = new Audio(this);
    this.drawBackground();
    this.buildGrid();
    this.buildHud();
    this.buildParticles();
    this.buildMallet();

    // 1-second countdown tick.
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.tickClock,
      callbackScope: this,
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    if (typeof __DEV__ !== 'undefined' && __DEV__) this.exposeTestHooks();
  }

  // --- build --------------------------------------------------------------

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-1000);
    // vertical grass gradient drawn as a few stacked bands (top lighter)
    const bands = [
      [0x96d24f, 0],
      [0x84c545, 0.28],
      [0x74b83c, 0.58],
      [0x67ad34, 1],
    ] as const;
    for (let i = 0; i < bands.length; i++) {
      const [col, t] = bands[i];
      const yTop = t * GAME_HEIGHT;
      const yBot = i + 1 < bands.length ? bands[i + 1][1] * GAME_HEIGHT : GAME_HEIGHT;
      g.fillStyle(col, 1).fillRect(0, yTop, GAME_WIDTH, yBot - yTop + 1);
    }
    // soft mounded ridges across the field for gentle depth
    g.fillStyle(0x7cc043, 0.45);
    for (let yy = 180; yy < GAME_HEIGHT; yy += 150) {
      g.fillEllipse(GAME_WIDTH / 2, yy, GAME_WIDTH * 1.5, 64);
    }
    // scattered grass blades (deterministic so it's stable across restarts)
    const blade = (x: number, y: number, col: number) => {
      g.fillStyle(col, 1).fillTriangle(x - 2, y, x, y - 6, x + 2, y);
    };
    let seed = 1337;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 110; i++) {
      const x = rnd() * GAME_WIDTH;
      const y = 120 + rnd() * (GAME_HEIGHT - 120);
      blade(x, y, rnd() > 0.5 ? 0x57a234 : 0x8fd457);
    }
  }

  private buildGrid(): void {
    const marginX = 70;
    const top = 250;
    const bottom = GAME_HEIGHT - 80;
    const colGap = (GAME_WIDTH - marginX * 2) / (GRID_COLS - 1);
    const rowGap = (bottom - top) / (GRID_ROWS - 1);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = marginX + c * colGap;
        const y = top + r * rowGap;
        const hole = new Hole(this, x, y);
        hole.onHit = this.onWhack;
        this.holes.push(hole);
      }
    }
  }

  private buildHud(): void {
    // top banner
    this.add.rectangle(GAME_WIDTH / 2, 40, GAME_WIDTH, 80, 0x000000, 0.28).setDepth(900);

    this.scoreText = this.add
      .text(16, 18, 'SCORE 0', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setDepth(901);

    this.comboText = this.add
      .text(16, 46, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffe14d',
        fontStyle: 'bold',
      })
      .setDepth(901);

    this.timeText = this.add
      .text(GAME_WIDTH - 16, 18, String(ROUND_SECONDS), {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(901);

    this.timeBar = this.add.graphics().setDepth(901);
    this.redrawTimeBar();

    // mute toggle (house style: text, no emoji), bottom-left corner
    const muteBtn = this.add
      .text(10, GAME_HEIGHT - 26, this.audio.muted ? '[MUTED]' : '[SOUND]', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#00000055',
        padding: { x: 6, y: 3 },
      })
      .setDepth(902)
      .setInteractive({ useHandCursor: true });
    muteBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      const muted = this.audio.toggleMute();
      muteBtn.setText(muted ? '[MUTED]' : '[SOUND]');
      if (!muted) this.audio.play(AudioKeys.Click);
    });
  }

  private buildParticles(): void {
    this.dirtEmitter = this.add.particles(0, 0, TexKeys.Dirt, {
      lifespan: 420,
      speed: { min: 80, max: 220 },
      angle: { min: 200, max: 340 },
      gravityY: 700,
      scale: { start: 1.2, end: 0.2 },
      rotate: { min: 0, max: 360 },
      emitting: false,
    });
    this.dirtEmitter.setDepth(800);

    this.starEmitter = this.add.particles(0, 0, TexKeys.Star, {
      lifespan: 500,
      speed: { min: 40, max: 140 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      emitting: false,
    });
    this.starEmitter.setDepth(801);
  }

  private buildMallet(): void {
    // the weapon chosen on the menu (defaults to hammer)
    const weapon = (this.registry.get(REG_WEAPON) as WeaponId) ?? 'swatter';
    const tex = WEAPON_TEX[weapon] ?? TexKeys.WeaponSwatter;
    // origin at the centre of the striking head so it lands where the player taps.
    this.mallet = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, tex)
      .setOrigin(WEAPON_ORIGIN.x, WEAPON_ORIGIN.y)
      .setAngle(0)
      .setDepth(1000);
    this.swing.lift = 0;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.malletX = p.x;
      this.malletY = p.y;
    });
    // swing the mallet on any tap (even a miss) for feel.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.malletX = p.x;
      this.malletY = p.y;
      this.swingMallet();
    });
  }

  // Apply pointer-follow + the current swing lift every frame. When lifted, the
  // head sits HIGHER on screen (raised, ready); the strike drives lift back to 0
  // (and slightly past) so the head visibly travels DOWN onto the target.
  private positionMallet(): void {
    this.mallet.x = this.malletX;
    this.mallet.y = this.malletY - this.swing.lift;
  }

  // --- loop ---------------------------------------------------------------

  update(time: number, deltaMs: number): void {
    this.positionMallet(); // keep the mallet on the cursor + apply swing lift
    if (!this.running) return;
    if (time < this.frozenUntil) return; // hit-stop: hold spawns for a beat
    this.spawnTimer += deltaMs;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnWave();
    }
  }

  // Spawn a wave of 1..N characters at once into random free holes. N ramps up
  // over the round (1 early → up to 3 late) so the field gets busier.
  private spawnWave(): void {
    const t = Phaser.Math.Clamp(this.elapsed / ROUND_SECONDS, 0, 1);
    const maxConcurrent = Math.round(Phaser.Math.Linear(1, 3, t)); // 1 → 3
    // weighted toward fewer; only occasionally the full max
    const want = this.rng.frac() < 0.5 ? 1 : this.rng.between(2, maxConcurrent);
    const count = Math.max(1, want);
    for (let i = 0; i < count; i++) this.spawnOne(t);
  }

  private spawnOne(t: number): void {
    const free = this.holes.filter((h) => h.isAvailable);
    if (free.length === 0) return;
    const hole = free[this.rng.between(0, free.length - 1)];

    // difficulty ramps: slightly fewer friendlies + a small boss chance late on.
    const friendlyChance = Phaser.Math.Linear(0.32, 0.22, t);
    const bossChance = Phaser.Math.Linear(0.05, 0.1, t);
    const def = pickChar(this.rng, this.roster, friendlyChance, bossChance, this.lastFrame);
    this.lastFrame = def.frame;

    // up-window: bosses pop briefly (hard), friendlies linger (fair to read),
    // plus a ±18% random jitter per pop so the rhythm is unpredictable.
    let upMs = Phaser.Math.Linear(1100, 620, t);
    if (def.kind === 'boss') upMs *= 0.7;
    if (def.kind === 'friendly') upMs *= 1.15;
    upMs *= this.rng.realInRange(0.82, 1.18);

    hole.pop(def, upMs);
  }

  private onWhack = (hole: Hole, def: CharDef, x: number, y: number): void => {
    if (def.kind === 'friendly') {
      // penalty — broke the rule
      this.combo = 0;
      this.friendlyHits += 1;
      this.score = Math.max(0, this.score - FRIENDLY_PENALTY);
      this.cameras.main.shake(160, 0.012);
      this.cameras.main.flash(120, 120, 0, 0); // red sting
      this.popText(x, y, `-${FRIENDLY_PENALTY}`, '#ff5a5a');
      this.dirtEmitter.emitParticleAt(x, y, 8);
      this.audio.play(AudioKeys.Oops);
    } else {
      const base = def.kind === 'boss' ? BOSS_POINTS : ENEMY_POINTS;
      const prevMult = this.comboMult();
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      // tally this character for the end-of-round breakdown
      this.whackCounts.set(def.frame, (this.whackCounts.get(def.frame) ?? 0) + 1);
      const mult = this.comboMult();
      const gained = base * mult;
      this.score += gained;
      const big = def.kind === 'boss';
      this.cameras.main.shake(big ? 160 : 90, big ? 0.01 : 0.007);
      this.starEmitter.emitParticleAt(x, y, big ? 18 : 10);
      this.dirtEmitter.emitParticleAt(hole.x, hole.y - 6, big ? 12 : 7);
      this.impactBurst(x, y, big);
      this.popText(x, y, `+${gained}`, big ? '#ffd23f' : '#ffffff');
      // sound: boss thud vs pitched bonk; a flourish when the multiplier rises
      if (big) this.audio.play(AudioKeys.Boss);
      else this.audio.playPitched(AudioKeys.Bonk);
      if (mult > prevMult) this.audio.play(AudioKeys.Combo);
    }
    this.refreshHud();
    void hole;
  };

  private comboMult(): number {
    if (this.combo >= 12) return 3;
    if (this.combo >= 6) return 2;
    return 1;
  }

  private tickClock(): void {
    if (!this.running) return;
    this.timeLeft -= 1;
    this.elapsed += 1;
    // speed up spawns over the round
    const t = Phaser.Math.Clamp(this.elapsed / ROUND_SECONDS, 0, 1);
    this.spawnInterval = Phaser.Math.Linear(900, 420, t);
    this.timeText.setText(String(Math.max(0, this.timeLeft)));
    this.redrawTimeBar();
    if (this.timeLeft <= 0) this.endGame();
    else if (this.timeLeft <= 5) {
      this.timeText.setColor('#ff5a5a');
      this.tweens.add({ targets: this.timeText, scale: 1.3, duration: 150, yoyo: true });
    }
  }

  // --- feedback / juice ---------------------------------------------------

  // A vertical SLAM: the head first RAISES UP (lift increases — it rises toward
  // the top of the screen, growing a touch as if rearing back), then DRIVES DOWN
  // onto the target (lift goes to 0 and slightly past), then settles. This reads
  // as "raise then hammer down", not a left/right wobble.
  private swingMallet(): void {
    this.tweens.killTweensOf(this.swing);
    this.tweens.killTweensOf(this.mallet);
    this.swing.lift = 0;
    this.mallet.setScale(1).setAngle(0);

    // lift: rise up (anticipation) → slam down past target → settle to rest
    this.tweens.chain({
      targets: this.swing,
      tweens: [
        { lift: 42, duration: 90, ease: 'Quad.easeOut' }, // RAISE up
        { lift: -8, duration: 70, ease: 'Quad.easeIn' }, // SLAM down (overshoot)
        { lift: 0, duration: 200, ease: 'Back.easeOut' }, // settle
      ],
    });
    // a small back-tilt on the raise, snapping forward on the slam, for weight
    this.tweens.chain({
      targets: this.mallet,
      tweens: [
        { angle: -16, duration: 90, ease: 'Quad.easeOut' },
        { angle: 6, duration: 70, ease: 'Quad.easeIn' },
        { angle: 0, duration: 200, ease: 'Back.easeOut' },
      ],
    });
    // grow slightly on the raise (rearing toward the viewer), squash on impact
    this.tweens.chain({
      targets: this.mallet,
      tweens: [
        { scaleX: 1.1, scaleY: 1.12, duration: 90, ease: 'Quad.easeOut' },
        { scaleX: 1.16, scaleY: 0.86, duration: 70, ease: 'Quad.easeIn' }, // squash on hit
        { scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' },
      ],
    });
  }

  // The impact when a bonk lands: white flash ring + extra shake + brief hit-stop.
  private impactBurst(x: number, y: number, big: boolean): void {
    // expanding ring
    const ring = this.add
      .image(x, y, TexKeys.Ring)
      .setDepth(905)
      .setScale(0.3)
      .setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      scale: big ? 1.8 : 1.2,
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    // brief hit-stop (scaled by weight) — freezes spawns/ducks momentarily
    this.frozenUntil = this.time.now + (big ? 90 : 45);
  }

  private popText(x: number, y: number, msg: string, color: string): void {
    const t = this.add
      .text(x, y, msg, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(950);
    this.tweens.add({
      targets: t,
      y: y - 46,
      alpha: 0,
      scale: 1.2,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private refreshHud(): void {
    this.scoreText.setText(`SCORE ${this.score}`);
    const mult = this.comboMult();
    if (this.combo >= 2) {
      this.comboText.setText(`COMBO x${this.combo}${mult > 1 ? `  (${mult}× pts)` : ''}`);
    } else {
      this.comboText.setText('');
    }
    this.tweens.killTweensOf(this.scoreText);
    this.scoreText.setScale(1);
    this.tweens.add({ targets: this.scoreText, scale: 1.18, duration: 90, yoyo: true });
  }

  private redrawTimeBar(): void {
    const w = GAME_WIDTH - 32;
    const frac = Phaser.Math.Clamp(this.timeLeft / ROUND_SECONDS, 0, 1);
    this.timeBar.clear();
    this.timeBar.fillStyle(0x000000, 0.35).fillRect(16, 70, w, 8);
    const col = frac > 0.33 ? 0x6cf06c : 0xff5a5a;
    this.timeBar.fillStyle(col, 1).fillRect(16, 70, w * frac, 8);
  }

  // --- end ----------------------------------------------------------------

  private endGame(): void {
    if (!this.running) return;
    this.running = false;
    this.audio.play(AudioKeys.TimeUp);
    this.time.removeAllEvents();
    this.holes.forEach((h) => h.duck(false));

    // persist best locally + submit to the leaderboard (fail-safe, once).
    Storage.setBest(this.score);
    this.submitRun();

    // dim the field
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setDepth(1099);

    // Build the breakdown list (whacked enemies/bosses), most-hit first.
    const breakdown = [...this.whackCounts.entries()].sort((a, b) => b[1] - a[1]);
    const totalWhacked = breakdown.reduce((a, [, n]) => a + n, 0);

    // size the panel to fit the breakdown grid (4 icons per row)
    const cols = 4;
    const rows = Math.max(1, Math.ceil(breakdown.length / cols));
    const gridH = rows * 56;
    const panelH = Math.min(GAME_HEIGHT - 60, 360 + gridH);
    const cx = GAME_WIDTH / 2;
    const top = (GAME_HEIGHT - panelH) / 2;

    this.add
      .rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH - 48, panelH, 0x1a1024, 0.95)
      .setDepth(1100)
      .setStrokeStyle(3, 0xffe14d);

    let y = top + 34;
    this.add
      .text(cx, y, "TIME'S UP!", {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: '#ffe14d',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1101);

    y += 52;
    this.add
      .text(cx, y, `SCORE  ${this.score}`, {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1101);

    y += 30;
    this.add
      .text(cx, y, `Whacked ${totalWhacked}   ·   Best combo x${this.bestCombo}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#9aa0ff',
      })
      .setOrigin(0.5)
      .setDepth(1101);

    // divider + section label
    y += 28;
    this.add
      .text(cx, y, '— WHAT YOU WHACKED —', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffd23f',
      })
      .setOrigin(0.5)
      .setDepth(1101);

    // the icon × count grid
    y += 24;
    const gridW = GAME_WIDTH - 110;
    const cellW = gridW / cols;
    const startX = cx - gridW / 2 + cellW / 2;
    if (breakdown.length === 0) {
      this.add
        .text(cx, y + 20, 'nothing! try bonking the cheeky ones 😅', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#cfcfe6',
        })
        .setOrigin(0.5)
        .setDepth(1101);
    }
    breakdown.forEach(([frame, count], i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const ix = startX + c * cellW;
      const iy = y + 22 + r * 56;
      // icon (scaled to ~36px tall)
      const icon = this.add
        .sprite(ix - 10, iy, AtlasKeys.Sprites, frame)
        .setDepth(1101)
        .setOrigin(0.5);
      const scale = 38 / icon.height;
      icon.setScale(scale);
      // ×count
      this.add
        .text(ix + 16, iy, `x${count}`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
        .setDepth(1101);
    });

    // friendly mistakes line
    let afterGridY = y + 22 + rows * 56 + 6;
    if (this.friendlyHits > 0) {
      this.add
        .text(cx, afterGridY, `Oops — spared friends bonked: x${this.friendlyHits}`, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ff7a7a',
        })
        .setOrigin(0.5)
        .setDepth(1101);
      afterGridY += 22;
    }

    // LEADERBOARD button (above the retry prompt). A modal flag stops the
    // "tap to play again" handler from also firing while the board is open.
    let boardOpen = false;
    const boardBtn = this.add
      .text(cx, top + panelH - 64, '[ LEADERBOARD ]', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#3a6b1f',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(1101)
      .setInteractive({ useHandCursor: true });
    boardBtn.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev?: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (boardOpen) return;
      boardOpen = true;
      showLeaderboard(this, () => { boardOpen = false; });
    });

    const retry = this.add
      .text(cx, top + panelH - 30, '▶ TAP TO PLAY AGAIN', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#7ec850',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1101);
    this.tweens.add({ targets: retry, alpha: 0.4, duration: 600, yoyo: true, loop: -1 });

    // ignore the swing click that may have just ended things; arm after a beat.
    // The leaderboard modal flag suppresses a restart while the board is open.
    this.time.delayedCall(400, () => {
      const restart = () => { if (!boardOpen) this.scene.restart(); };
      this.input.on('pointerdown', restart);
      this.input.keyboard?.on('keydown', restart);
    });
  }

  // Fire-and-forget submit of the finished run to the leaderboard. Fail-safe:
  // a network/CORS error never throws into the game; guarded to submit once.
  private submitRun(): void {
    if (this.submitted) return;
    this.submitted = true;
    if (!Api.enabled) return;
    const whacks = [...this.whackCounts.values()].reduce((a, n) => a + n, 0);
    void Api.submitRun({
      score: this.score,
      startedAt: this.roundStartedAt,
      endedAt: Date.now(),
      whacks,
      bestCombo: this.bestCombo,
      friendlyHits: this.friendlyHits,
    }).catch(() => { /* fail-safe — ignore */ });
  }

  private cleanup(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.off('pointermove');
    this.input.off('pointerdown');
    this.holes.forEach((h) => h.destroy());
    this.holes = [];
  }

  // --- dev/test hooks (tree-shaken from prod) -----------------------------

  private exposeTestHooks(): void {
    const api = {
      getState: () => ({
        score: this.score,
        combo: this.combo,
        timeLeft: this.timeLeft,
        running: this.running,
        popped: this.holes.filter((h) => h.state === 'up' || h.state === 'rising').length,
        whacks: Object.fromEntries(this.whackCounts),
        friendlyHits: this.friendlyHits,
      }),
      // jump to game-over immediately for verifying the report layout
      forceEnd: () => {
        this.timeLeft = 0;
        this.endGame();
      },
      // force a specific kind into a free hole, return its screen position
      forcePop: (kind: 'enemy' | 'boss' | 'friendly') => {
        const free = this.holes.filter((h) => h.isAvailable);
        if (!free.length) return null;
        const hole = free[0];
        const pool =
          kind === 'friendly'
            ? [{ frame: 'capybara', kind: 'friendly', weight: 1 } as CharDef]
            : kind === 'boss'
              ? [{ frame: 'mole-boss', kind: 'boss', weight: 1 } as CharDef]
              : [{ frame: 'cat-black', kind: 'enemy', weight: 1 } as CharDef];
        hole.pop(pool[0], 5000);
        return { x: hole.x, y: hole.y };
      },
      whackAt: (x: number, y: number) => {
        this.input.emit(
          'pointerdown',
          { x, y, worldX: x, worldY: y } as unknown as Phaser.Input.Pointer,
        );
      },
    };
    (window as unknown as { __WAM__?: typeof api }).__WAM__ = api;
  }
}
