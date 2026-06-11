import Phaser from 'phaser';
import { SceneKeys, CharKeys, MONSTERS } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// ── Turn-based battle ────────────────────────────────────────────────────────
// Party of 3 vs one monster, command-driven like the reference screenshot. Each
// round the heroes act in order (player picks Attack / Skill / Item / Retreat per
// hero), then the monster strikes a random living hero. Damage numbers, HP/SP bars,
// lunge + hit-flash juice. Win → return to overworld; party wipe → game over.
//
// Launched via scene.launch(Battle, { typeIndex }) with GameScene paused; ends by
// scene.resume(Game) + scene.stop(self).

interface Combatant {
  name: string;
  hp: number; maxHp: number;
  sp: number; maxSp: number;
  atk: number; spd: number;
  sprite: Phaser.GameObjects.Sprite;
  idleKey: string; attackKey: string;
  alive: boolean;
}

const PARTY_STATS = [
  { name: 'Rem',    maxHp: 28, maxSp: 8, atk: 7, spd: 9, idle: CharKeys.RemIdle,    attack: CharKeys.RemAttack },
  { name: 'Hollis', maxHp: 34, maxSp: 5, atk: 6, spd: 6, idle: CharKeys.HollisIdle, attack: CharKeys.HollisAttack },
  { name: 'Moz',    maxHp: 40, maxSp: 4, atk: 8, spd: 5, idle: CharKeys.MozIdle,    attack: CharKeys.MozAttack },
];
const MONSTER_STATS = [
  { maxHp: 30, atk: 5, spd: 7 },  // snake
  { maxHp: 22, atk: 7, spd: 11 }, // raven (fast, fragile)
  { maxHp: 44, atk: 4, spd: 3 },  // slime (tanky, slow)
  { maxHp: 36, atk: 6, spd: 6 },  // beetle
];
const MENU = ['Attack', 'Skill', 'Item', 'Retreat'] as const;
const H = { white: '#f4f4f4', dim: '#94b0c2', hp: '#b13e53', sp: '#3b5dc9', gold: '#ffcd75', line: '#0d2438' };

export class BattleScene extends Phaser.Scene {
  private party: Combatant[] = [];
  private enemy!: Combatant;
  private order: number = 0; // which party hero is choosing (index into living party)
  private busy = false;
  private menuBoxes: Phaser.GameObjects.Container[] = [];
  private msg!: Phaser.GameObjects.Text;
  private bars: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super(SceneKeys.Battle);
  }

  create(data: { typeIndex?: number }): void {
    const ti = data?.typeIndex ?? 0;
    this.party = [];
    this.busy = false;
    this.order = 0;

    // backdrop — sky over meadow (the reference battle screen)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x6fb7e0).setDepth(0);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.74, GAME_WIDTH, GAME_HEIGHT * 0.52, 0x6fc04a).setDepth(0);

    // enemy (left)
    const m = MONSTERS[ti], ms = MONSTER_STATS[ti];
    const eSpr = this.add.sprite(GAME_WIDTH * 0.26, GAME_HEIGHT * 0.46, m.idle).setScale(1.5).setDepth(2);
    this.enemy = {
      name: m.name, hp: ms.maxHp, maxHp: ms.maxHp, sp: 0, maxSp: 0,
      atk: ms.atk, spd: ms.spd, sprite: eSpr, idleKey: m.idle, attackKey: m.attack, alive: true,
    };
    this.tweens.add({ targets: eSpr, y: eSpr.y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // party (right, staggered) — pull persisted HP/level later; fresh each battle for now
    PARTY_STATS.forEach((p, i) => {
      const spr = this.add.sprite(GAME_WIDTH * (0.62 + i * 0.12), GAME_HEIGHT * (0.4 + i * 0.06), p.idle)
        .setScale(1.4).setDepth(3 + i).setFlipX(true);
      this.tweens.add({ targets: spr, y: spr.y - 3, duration: 1100 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.party.push({
        name: p.name, hp: p.maxHp, maxHp: p.maxHp, sp: p.maxSp, maxSp: p.maxSp,
        atk: p.atk, spd: p.spd, sprite: spr, idleKey: p.idle, attackKey: p.attack, alive: true,
      });
    });

    this.msg = this.add.text(GAME_WIDTH / 2, 18, `A wild ${m.name} appeared!`, {
      fontFamily: 'monospace', fontSize: '13px', color: H.white, stroke: '#143a52', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(50);

    this.buildPartyHud();
    this.buildEnemyHud();
    this.buildMenu();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tweens.killAll());

    this.time.delayedCall(500, () => this.beginRound());
  }

  // ── round / turn flow ──────────────────────────────────────────────────────
  private beginRound(): void {
    this.order = 0;
    this.promptNextHero();
  }

  private livingParty(): Combatant[] { return this.party.filter((c) => c.alive); }

  /** Prompt the next living hero for a command, or once all have acted, the enemy. */
  private promptNextHero(): void {
    const living = this.livingParty();
    if (this.order >= living.length) { this.enemyTurn(); return; }
    const hero = living[this.order];
    this.setMessage(`${hero.name}'s turn`);
    this.highlight(hero);
    this.showMenu(true);
  }

  private chooseCommand(cmd: typeof MENU[number]): void {
    if (this.busy) return;
    const hero = this.livingParty()[this.order];
    if (!hero) return;
    this.showMenu(false);

    if (cmd === 'Retreat') { this.flee(); return; }
    if (cmd === 'Item') { this.useItem(hero); return; }
    // Attack / Skill both target the enemy
    const isSkill = cmd === 'Skill';
    if (isSkill && hero.sp < 3) { this.setMessage(`${hero.name} has no SP!`); this.time.delayedCall(700, () => this.showMenu(true)); return; }
    this.heroStrike(hero, isSkill);
  }

  private heroStrike(hero: Combatant, isSkill: boolean): void {
    this.busy = true;
    if (isSkill) hero.sp -= 3;
    hero.sprite.setTexture(hero.attackKey);
    const baseX = hero.sprite.x;
    // lunge toward the enemy (to the left)
    this.tweens.add({
      targets: hero.sprite, x: baseX - 26, duration: 130, yoyo: true, ease: 'Quad.out',
      onYoyo: () => {
        const dmg = Math.round((hero.atk + Phaser.Math.Between(0, 2)) * (isSkill ? 2.1 : 1));
        this.dealDamage(this.enemy, dmg, isSkill ? H.gold : H.white);
      },
      onComplete: () => {
        hero.sprite.setTexture(hero.idleKey);
        this.refreshBars();
        if (!this.enemy.alive) { this.win(); return; }
        this.advanceHero();
      },
    });
  }

  private useItem(hero: Combatant): void {
    this.busy = true;
    const heal = 14;
    hero.hp = Math.min(hero.maxHp, hero.hp + heal);
    this.floatText(hero.sprite.x, hero.sprite.y - 28, `+${heal}`, H.gold);
    this.flashTint(hero.sprite, 0xa7f070);
    this.refreshBars();
    this.setMessage(`${hero.name} drinks a potion`);
    this.time.delayedCall(560, () => this.advanceHero());
  }

  private advanceHero(): void {
    this.busy = false;
    this.clearHighlight();
    this.order++;
    this.promptNextHero();
  }

  // ── enemy turn ───────────────────────────────────────────────────────────
  private enemyTurn(): void {
    if (!this.enemy.alive) { this.win(); return; }
    this.busy = true;
    this.clearHighlight();
    const targets = this.livingParty();
    const target = Phaser.Utils.Array.GetRandom(targets);
    this.setMessage(`${this.enemy.name} attacks ${target.name}!`);
    this.enemy.sprite.setTexture(this.enemy.attackKey);
    const baseX = this.enemy.sprite.x;
    this.tweens.add({
      targets: this.enemy.sprite, x: baseX + 30, duration: 150, yoyo: true, ease: 'Quad.out',
      onYoyo: () => {
        const dmg = this.enemy.atk + Phaser.Math.Between(0, 2);
        this.dealDamage(target, dmg, H.hp);
      },
      onComplete: () => {
        this.enemy.sprite.setTexture(this.enemy.idleKey);
        this.refreshBars();
        if (this.livingParty().length === 0) { this.gameOver(); return; }
        this.busy = false;
        this.beginRound();
      },
    });
  }

  // ── damage / death ───────────────────────────────────────────────────────
  private dealDamage(target: Combatant, dmg: number, color: string): void {
    target.hp = Math.max(0, target.hp - dmg);
    this.floatText(target.sprite.x, target.sprite.y - 30, `${dmg}`, color);
    this.flashTint(target.sprite, 0xffffff);
    this.cameras.main.shake(120, 0.005);
    if (target.hp <= 0 && target.alive) {
      target.alive = false;
      this.tweens.add({ targets: target.sprite, alpha: 0.25, angle: target === this.enemy ? 0 : 90, duration: 400 });
    }
  }

  // ── outcomes ─────────────────────────────────────────────────────────────
  private win(): void {
    this.busy = true;
    this.showMenu(false);
    this.clearHighlight();
    this.setMessage(`${this.enemy.name} defeated!  +EXP`);
    this.time.delayedCall(1100, () => this.finish());
  }
  private flee(): void {
    this.setMessage('Got away safely!');
    this.time.delayedCall(700, () => this.finish());
  }
  private gameOver(): void {
    this.busy = true;
    this.setMessage('The party fell...');
    this.cameras.main.shake(300, 0.01);
    this.time.delayedCall(1300, () => this.finish());
  }

  /** Fade out, resume the overworld, stop this scene. */
  private finish(): void {
    this.cameras.main.fade(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.resume(SceneKeys.Game);
      this.scene.stop();
    });
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  private buildMenu(): void {
    const x = 10, y0 = GAME_HEIGHT - 14 - MENU.length * 25;
    this.menuBoxes = MENU.map((label, i) => {
      const y = y0 + i * 25;
      const box = this.add.rectangle(0, 0, 112, 21, 0x12324a, 0.94).setStrokeStyle(2, 0x49a7e0);
      const txt = this.add.text(-46, -7, label, { fontFamily: 'monospace', fontSize: '13px', color: '#eaf6ff' });
      const c = this.add.container(x + 56, y + 10, [box, txt]).setDepth(60).setSize(112, 21).setInteractive();
      c.on('pointerover', () => box.setFillStyle(0x1d4e72, 0.96));
      c.on('pointerout', () => box.setFillStyle(0x12324a, 0.94));
      c.on('pointerup', () => this.chooseCommand(label));
      return c;
    });
    // keyboard shortcuts: A/S/I/R, Esc = retreat
    this.input.keyboard?.on('keydown-A', () => this.chooseCommand('Attack'));
    this.input.keyboard?.on('keydown-S', () => this.chooseCommand('Skill'));
    this.input.keyboard?.on('keydown-I', () => this.chooseCommand('Item'));
    this.input.keyboard?.on('keydown-R', () => this.chooseCommand('Retreat'));
    this.input.keyboard?.on('keydown-ESC', () => this.chooseCommand('Retreat'));
    this.showMenu(false);
  }

  private showMenu(on: boolean): void {
    this.menuBoxes.forEach((c) => c.setVisible(on));
  }

  private setMessage(t: string): void { this.msg.setText(t); }

  private buildPartyHud(): void {
    // three stacked stat plates bottom-right, like the reference's Rem/Hollis/Moz row
    const w = 150, h = 30, x = GAME_WIDTH - w - 8;
    this.party.forEach((c, i) => {
      const y = GAME_HEIGHT - 8 - (this.party.length - i) * (h + 3);
      const g = this.add.graphics().setDepth(40);
      this.bars.push(g);
      this.add.text(x + 4, y + 2, c.name, { fontFamily: 'monospace', fontSize: '11px', color: H.gold }).setDepth(41);
      c.sprite.setData('hudY', y); c.sprite.setData('hudX', x); c.sprite.setData('hudW', w); c.sprite.setData('hudH', h);
    });
    this.refreshBars();
  }
  private buildEnemyHud(): void {
    const g = this.add.graphics().setDepth(40);
    this.bars.push(g);
    this.add.text(12, 36, this.enemy.name, { fontFamily: 'monospace', fontSize: '11px', color: H.white,
      stroke: '#143a52', strokeThickness: 3 }).setDepth(41);
    this.enemy.sprite.setData('ehud', g);
  }

  private refreshBars(): void {
    // party plates
    const w = 150, h = 30;
    this.party.forEach((c, i) => {
      const g = this.bars[i]; if (!g) return;
      const x = c.sprite.getData('hudX') as number, y = c.sprite.getData('hudY') as number;
      g.clear();
      g.fillStyle(0x0d2438, 0.85).fillRoundedRect(x, y, w, h, 5);
      g.lineStyle(1, 0x294b6b, 1).strokeRoundedRect(x, y, w, h, 5);
      // HP bar
      const bx = x + 26, bw = w - 34;
      g.fillStyle(0x33202a, 1).fillRect(bx, y + 6, bw, 6);
      g.fillStyle(0xb13e53, 1).fillRect(bx, y + 6, bw * (c.hp / c.maxHp), 6);
      // SP bar
      g.fillStyle(0x1c2748, 1).fillRect(bx, y + 16, bw, 5);
      g.fillStyle(0x3b5dc9, 1).fillRect(bx, y + 16, bw * (c.maxSp ? c.sp / c.maxSp : 0), 5);
    });
    // labels HP/SP + numbers drawn once as text? redraw via small texts each refresh is costly;
    // keep it light — numbers are implied by bar length. (Full numeric HUD can come later.)

    // enemy HP bar above its sprite
    const g = this.enemy.sprite.getData('ehud') as Phaser.GameObjects.Graphics;
    if (g) {
      g.clear();
      const ex = 12, ey = 50, ew = 120;
      g.fillStyle(0x0d2438, 0.85).fillRoundedRect(ex - 2, ey - 2, ew + 4, 12, 4);
      g.fillStyle(0x33202a, 1).fillRect(ex, ey, ew, 8);
      g.fillStyle(0xb13e53, 1).fillRect(ex, ey, ew * (this.enemy.hp / this.enemy.maxHp), 8);
    }
  }

  // ── small fx helpers ──────────────────────────────────────────────────────
  private floatText(x: number, y: number, t: string, color: string): void {
    const txt = this.add.text(x, y, t, {
      fontFamily: 'monospace', fontSize: '16px', color, stroke: '#1a1c2c', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(80);
    this.tweens.add({ targets: txt, y: y - 22, alpha: 0, duration: 720, ease: 'Quad.out', onComplete: () => txt.destroy() });
  }
  private flashTint(spr: Phaser.GameObjects.Sprite, color: number): void {
    // Phaser 4: setTintFill(c) was removed → setTint + FILL mode for a solid flash.
    spr.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(90, () => { spr.clearTint(); spr.setTintMode(Phaser.TintModes.MULTIPLY); });
  }
  private highlight(hero: Combatant): void {
    hero.sprite.setData('hl', true);
    this.tweens.add({ targets: hero.sprite, scale: hero.sprite.scaleX * 1.08, duration: 200, yoyo: true });
  }
  private clearHighlight(): void { /* tween-based, auto-reverts */ }
}
