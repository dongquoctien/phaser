// Build every game under games/* into dist/<game>/, then generate the static-HTML
// hub (dist/index.html) — a "COLLECTION"-style pastel card grid. Used by
// `npm run build:all`.
//
// Base path: GitHub Pages serves from /<repo>/, so games build with base
// "/<repo>/<game>/" and the hub links accordingly. Override the repo segment via
// BASE_PATH env (e.g. BASE_PATH=/ for root-domain / local preview).
import {
  readdirSync,
  statSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { renderHub, gridToSvg } from './hub-template.mjs';

const gamesDir = 'games';
// Leading+trailing slash; "/phaser/" by default (this repo on GitHub Pages).
const BASE = (process.env.BASE_PATH ?? '/phaser/').replace(/\/?$/, '/');

if (!existsSync(gamesDir)) {
  console.error('No games/ directory found.');
  process.exit(1);
}

const games = readdirSync(gamesDir).filter((name) => {
  const p = join(gamesDir, name);
  return statSync(p).isDirectory() && existsSync(join(p, 'vite.config.mjs'));
});

if (games.length === 0) {
  console.log('No games to build.');
  process.exit(0);
}

function titleOf(game) {
  try {
    const file = join(gamesDir, game, 'index.html');
    if (existsSync(file)) {
      const m = readFileSync(file, 'utf8').match(/<title>([^<]*)<\/title>/i);
      if (m) return m[1].trim();
    }
  } catch {
    /* ignore */
  }
  return game;
}

// Gather display metadata + optional pixel thumb. Missing/malformed never throws.
function metaOf(game) {
  let meta = {};
  const file = join(gamesDir, game, 'game.json');
  if (existsSync(file)) {
    try {
      meta = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn(`  ! ${game}/game.json invalid JSON — ignoring (${e.message})`);
    }
  }
  let thumb = null;
  if (meta.thumb && Array.isArray(meta.thumb.grid) && meta.thumb.map) {
    const rows = meta.thumb.grid;
    const ok =
      rows.length > 0 &&
      rows.every((r) => typeof r === 'string' && r.length === rows[0].length);
    if (ok) thumb = { grid: rows, map: meta.thumb.map };
    else console.warn(`  ! ${game}/game.json thumb has ragged rows — ignoring`);
  }
  return {
    name: game,
    title: (meta.title && String(meta.title).trim()) || titleOf(game),
    description: (meta.description && String(meta.description).trim()) || '',
    tags: Array.isArray(meta.tags) ? meta.tags.map(String).slice(0, 4) : [],
    // Category groups the game on the hub. Missing → "Arcade".
    category: (meta.category && String(meta.category).trim()) || 'Arcade',
    thumb,
  };
}

// Resolve a game's card artwork as ready-to-embed HTML.
// Priority: committed cover.svg → cover.png → pixel thumb (SVG) → cabinet default.
function artOf(game, thumb) {
  const svg = join(gamesDir, game, 'cover.svg');
  if (existsSync(svg)) {
    // Inline the committed SVG; tag it with the card-art class for sizing.
    return readFileSync(svg, 'utf8').replace('<svg', '<svg class="card-art"');
  }
  const png = join(gamesDir, game, 'cover.png');
  if (existsSync(png)) {
    const b64 = readFileSync(png).toString('base64');
    return `<img class="card-art" src="data:image/png;base64,${b64}" alt="" />`;
  }
  if (thumb) return gridToSvg(thumb);
  return null; // renderCard falls back to the cabinet glyph
}

// ── 1. Build each game ─────────────────────────────────────────────────────────
for (const game of games) {
  const base = `${BASE}${game}/`;
  console.log(`\n▶ Building ${game}  (base ${base}) ...`);
  // Base via env (GAME_BASE), NOT a CLI flag (Git Bash mangles a leading "/").
  execSync(`npx vite build --config games/${game}/vite.config.mjs games/${game}`, {
    stdio: 'inherit',
    env: { ...process.env, GAME_BASE: base },
  });
}

// ── 2. Build the hub model (metadata + resolved artwork) ───────────────────────
const model = games.map((game) => {
  const m = metaOf(game);
  return {
    name: m.name,
    title: m.title,
    description: m.description,
    tags: m.tags,
    category: m.category,
    href: `${BASE}${game}/`,
    art: artOf(game, m.thumb),
  };
});

// ── 3. Write the static-HTML hub ───────────────────────────────────────────────
writeFileSync('dist/index.html', renderHub({ games: model }));
// .nojekyll skips Jekyll processing on GitHub Pages.
writeFileSync('dist/.nojekyll', '');

console.log(`\n✓ Built ${games.length} game(s) + static hub → dist/ (base ${BASE})`);
