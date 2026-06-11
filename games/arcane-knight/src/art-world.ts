// Enemies, boss, tiles and FX (32×32 / smaller, Sweetie-16). Hand-drawn for this
// game. Enemies face LEFT (toward an incoming right-facing hero); the game flips
// them by velocity.
import Phaser from 'phaser';
import { bakeSprite, SWEETIE16_HEX as H, type PixelGrid } from '../../../src/pixel';
import { Tex } from './types/keys';

// ── SLIME (green, 2-frame squash) ──
const SLIME: Record<string, string | null> = { '.': null, K: H.black, g: H.green, G: H.lime, t: H.teal, e: H.black, w: H.white };
const SLIME0: PixelGrid = { map: SLIME, grid: [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..........KKKKKKKK..............',
  '........KKgGGGGGGgKK............',
  '.......KgGGgggggggGgK...........',
  '......KgGgggggggggggGK..........',
  '......KgggwwgggggwwggK..........',
  '......KgggweKgggggweKg..........',
  '......KgggwwgggggwwggK..........',
  '......KtggggggggggggtK..........',
  '......KttgggggggggttgK..........',
  '......KKttttggggttttKK..........',
  '........KKttttttttKK............',
  '..........KKKKKKKK..............',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
] };
const SLIME1: PixelGrid = { map: SLIME, grid: [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '.........KKKKKKKKKK.............',
  '.......KKgGGGGGGGGgKK...........',
  '......KgGGgggggggggGgK..........',
  '.....KgGggwwgggggwwgggK.........',
  '.....KgggweKgggggweKggK.........',
  '.....KgggwwgggggwwgggGK.........',
  '.....KtgggggggggggggtgK.........',
  '.....KttggggggggggggttK.........',
  '....KKtttttgggggttttttKK........',
  '....KKttttttttttttttttKK........',
  '......KKKKKKKKKKKKKKKK..........',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
] };

// ── BAT (grey, flapping) ──
const BAT: Record<string, string | null> = { '.': null, K: H.black, g: H.slate, d: H.dark, e: H.red, w: H.grey };
const BAT0: PixelGrid = { map: BAT, grid: [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '....KK..............KK..........',
  '...KdgK............KgdK.........',  // wings up
  '...KdggK..KKKK....KggdK.........',
  '...KdgggKKgwwgKKKggggdK.........',
  '....KdggggweewggggggdK..........',
  '.....KdggwwwwwwggggdK...........',
  '......KKddggggggddKK............',
  '.........KKddddKK...............',
  '...........KKKK.................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
] };
const BAT1: PixelGrid = { map: BAT, grid: [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..........KKKK..................',
  '.........KgwwgK.................',
  '....KKKKKgwweewgKKKKK...........',  // wings out flat
  '...KdgggggweewggggggdK..........',
  '...KKddggwwwwwwggggddKK.........',
  '.....KKddggggggggddKK...........',
  '........KKddddddKK..............',
  '..........KKKKKK................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
] };

// ── SKELETON (walking, bone + dark armor) faces left ──
const SKEL: Record<string, string | null> = { '.': null, K: H.black, b: H.white, B: H.grey, a: H.slate, e: H.red, d: H.dark };
const SKEL0: PixelGrid = { map: SKEL, grid: [
  '................................',
  '................................',
  '................................',
  '..........KKKK..................',
  '.........KbbbbK.................',
  '........KbBeebBK................',  // skull + red eyes
  '........KbbbbbbK................',
  '........KKbbbbKK................',
  '.........KbbbbK.................',
  '........KaadaaaK................',  // ribcage
  '.......KaBbbbbBaK...............',
  '.......KabKbbKbaK...............',
  '.......KaBbbbbBaK...............',
  '........KbbbbbbK................',
  '........KaB..BaK................',
  '........Kbb..bbK................',
  '........KaB..BaK................',
  '.......KKbb..bbKK...............',
  '......KbbbK..KbbbK..............',
  '......KKKK....KKKK..............',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
] };
const SKEL1: PixelGrid = { map: SKEL, grid: [
  '................................',
  '................................',
  '................................',
  '..........KKKK..................',
  '.........KbbbbK.................',
  '........KbBeebBK................',
  '........KbbbbbbK................',
  '........KKbbbbKK................',
  '.........KbbbbK.................',
  '........KaadaaaK................',
  '.......KaBbbbbBaK...............',
  '.......KabKbbKbaK...............',
  '.......KaBbbbbBaK...............',
  '........KbbbbbbK................',
  '........KaBaaBaK................',
  '........KabbbbaK................',  // legs together
  '........KbbbbbbK................',
  '........KaB..BaK................',
  '.......KbbbK.KbbbK..............',
  '.......KKKK...KKKK..............',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
] };

// ── BOSS (big dark demon-knight, 32×32 full) ──
const BOSS: Record<string, string | null> = { '.': null, K: H.black, p: H.purple, P: H.darkblue, r: H.red, R: H.orange, a: H.slate, A: H.dark, e: H.yellow, h: H.grey };
const BOSS0: PixelGrid = { map: BOSS, grid: [
  '................................',
  '......K..............K..........',
  '.....KrK............KrK.........',  // horns
  '.....KRK............KRK.........',
  '....KKKKKK........KKKKKK........',
  '...KpPPPPpK......KpPPPPpK.......',
  '...KpPaaaPpKKKKKKpPaaaPpK.......',
  '...KpaeeaePppppppPeaeeaapK......',  // glowing eyes
  '....KpaaaaPpaaaapPaaaapK........',
  '.....KKKKKpaAAAApKKKKK..........',
  '.......KpPAhhhhAPpK.............',  // chest armor
  '......KpPAhhhhhhAPpK............',
  '.....KpPPAhrrrrhAPPpK...........',  // red core
  '.....KpPAhhRRRRhhAPpK...........',
  '.....KpPAhhrrrrhhAPpK...........',
  '......KpPAhhhhhhAPpK............',
  '......KKpPPAAAAPPpKK............',
  '.....KpPpK......KpPpK...........',  // arms
  '....KpPpK........KpPpK..........',
  '....KaAK..........KaAK..........',  // fists
  '....KKK............KKK..........',
  '.....KpPPPpKKKKpPPPpK...........',  // waist
  '.....KpaaaPpKKpPaaapK...........',
  '......KKaaKK..KKaaKK............',  // legs
  '......KpaaK....KpaaK............',
  '......KaAAK....KaAAK............',
  '.....KKKKKK....KKKKKK...........',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
] };
const BOSS1: PixelGrid = { map: BOSS, grid: BOSS0.grid.slice() };

// ── TILES ──
const GROUND: Record<string, string | null> = { '.': null, K: H.black, d: H.teal, D: H.darkblue, g: H.green, G: H.lime, b: H.dark };
const GROUND_T: PixelGrid = { map: GROUND, grid: [
  'gGgGgGgGgGgGgGgG',
  'GgGgGgGgGgGgGgGg',
  'dddddddddddddddd',
  'dDdddDddddDdddDd',
  'dddddddddddddddd',
  'dDdddddDdddddDdd',
  'bbbbbbbbbbbbbbbb',
  'bDbbbbDbbbbDbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbDbbbbbDbbbbbDb',
  'bbbbbbbbbbbbbbbb',
  'bbbbDbbbbbbDbbbb',
  'bbbbbbbbbbbbbbbb',
  'bDbbbbbbDbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'KKKKKKKKKKKKKKKK',
] };
const PLATFORM_T: PixelGrid = { map: GROUND, grid: [
  'gGgGgGgGgGgGgGgG',
  'dddddddddddddddd',
  'dDddddDdddddDddd',
  'bbbbbbbbbbbbbbbb',
  'bbDbbbbbbDbbbbbb',
  'KKKKKKKKKKKKKKKK',
  '..K..........K..',
  '..K..........K..',
] };
const SPIKE: Record<string, string | null> = { '.': null, K: H.black, w: H.white, g: H.grey, s: H.slate };
const SPIKE_T: PixelGrid = { map: SPIKE, grid: [
  '.K....K....K....',
  '.K....K....K....',
  'KwK..KwK..KwK...',
  'KwK..KwK..KwK...',
  'KgwK.KgwK.KgwK..',
  'KggKKKggKKKggK..',
  'KgggsgggsgggsgK.',
  'KKKKKKKKKKKKKKK.',
] };
const FLAG: Record<string, string | null> = { '.': null, K: H.black, p: H.lime, P: H.green, w: H.grey, y: H.yellow };
const FLAG_T: PixelGrid = { map: FLAG, grid: [
  '..Kw...........',
  '..KwKKKKKK.....',
  '..KwppppPK.....',
  '..KwpyyppK.....',
  '..KwppppPK.....',
  '..KwPPPPPK.....',
  '..KwKKKKKK.....',
  '..Kw...........',
  '..Kw...........',
  '..Kw...........',
  '..Kw...........',
  '..Kw...........',
  '..Kw...........',
  '.KKwKK.........',
  '.KwwwK.........',
  '.KKKKK.........',
] };
const CRYSTAL: Record<string, string | null> = { '.': null, K: H.black, g: H.cyan, G: H.skyblue, w: H.white };
const CRYSTAL_T: PixelGrid = { map: CRYSTAL, grid: [
  '....KK....',
  '...KgGK...',
  '..KgGGwK..',
  '..KgGGGK..',
  '.KgGGGGGK.',
  '.KgGwGGGK.',
  '..KgGGGK..',
  '..KgGGGK..',
  '...KgGK...',
  '....KK....',
] };

// ── FX ──
const SLASH_M: Record<string, string | null> = { '.': null, w: H.white, c: H.skyblue, b: H.blue };
const SLASH_T: PixelGrid = { map: SLASH_M, grid: [
  '..........bb....',
  '........bbccb...',
  '......bbccwwcb..',
  '....bbccwwwwcb..',
  '...bccwwww..cb..',
  '..bccww.....cb..',
  '..bcw.......cb..',
  '..bcw......bcb..',
  '..bccw....bccb..',
  '...bccwwwwwccb..',
  '....bbccwwccb...',
  '......bbccbb....',
  '........bb......',
  '................',
  '................',
  '................',
] };
const FIREBALL_M: Record<string, string | null> = { '.': null, c: H.cyan, g: H.skyblue, w: H.white, b: H.blue };
const FIREBALL_T: PixelGrid = { map: FIREBALL_M, grid: [
  '....gg....',
  '..ggccgg..',
  '.gcwwwwcg.',
  'gcwwwwwwcg',
  'gcwwwwwwcg',
  'gcwwwwwwcg',
  '.gcwwwwcg.',
  '..ggccgg..',
  '....gg....',
  '..........',
] };
const HIT_M: Record<string, string | null> = { '.': null, y: H.yellow, w: H.white, o: H.orange };
const HIT_T: PixelGrid = { map: HIT_M, grid: [
  '...y....y...',
  '....y..y....',
  'y...yooy...y',
  '.y.yowwoy.y.',
  '..yowwwwoy..',
  '...wwwwww...',
  '...wwwwww...',
  '..yowwwwoy..',
  '.y.yowwoy.y.',
  'y...yooy...y',
  '....y..y....',
  '...y....y...',
] };
const HEART_M: Record<string, string | null> = { '.': null, K: H.black, r: H.red, R: H.orange, w: H.white };
const HEART_T: PixelGrid = { map: HEART_M, grid: [
  '.KK..KK.',
  'KrRKKrRK',
  'KrwrrrRK',
  'KrrrrrRK',
  '.KrrrRK.',
  '..KrRK..',
  '...KK...',
  '........',
] };

export function bakeEnemies(scene: Phaser.Scene, px: number): void {
  bakeSprite(scene, Tex.Slime0, SLIME0, { px });
  bakeSprite(scene, Tex.Slime1, SLIME1, { px });
  bakeSprite(scene, Tex.Bat0, BAT0, { px });
  bakeSprite(scene, Tex.Bat1, BAT1, { px });
  bakeSprite(scene, Tex.Skeleton0, SKEL0, { px });
  bakeSprite(scene, Tex.Skeleton1, SKEL1, { px });
  bakeSprite(scene, Tex.Boss0, BOSS0, { px });
  bakeSprite(scene, Tex.Boss1, BOSS1, { px });
}
export function bakeTilesAndFx(scene: Phaser.Scene, px: number): void {
  bakeSprite(scene, Tex.Ground, GROUND_T, { px });
  bakeSprite(scene, Tex.Platform, PLATFORM_T, { px });
  bakeSprite(scene, Tex.Spike, SPIKE_T, { px });
  bakeSprite(scene, Tex.Flag, FLAG_T, { px });
  bakeSprite(scene, Tex.Crystal, CRYSTAL_T, { px });
  bakeSprite(scene, Tex.Slash, SLASH_T, { px });
  bakeSprite(scene, Tex.Fireball, FIREBALL_T, { px });
  bakeSprite(scene, Tex.Hit, HIT_T, { px });
  bakeSprite(scene, Tex.Heart, HEART_T, { px });
}
