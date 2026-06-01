// Static-HTML hub generator — a "COLLECTION"-style trading-card grid.
// build-all.mjs calls renderHub({games}) and writes the result to dist/index.html.
// Self-contained: inline CSS, system fonts (no network/base64 font), zero JS.
// Each game is one pastel <a> card; cards ARE the crawlable content.

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Pastel palette (light → near-black title reads on every one). Cycled per card.
const PALETTE = [
  '#A8E6CF', '#FFD3B6', '#FFAAA5', '#FFF1A8',
  '#C8B6FF', '#A0E7E5', '#FBC4E2', '#B5EAD7',
  '#FFDAC1', '#E2C2FF', '#BDE0FE', '#FBE7A1',
];
const pastel = (i) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

// Pick a title colour with enough contrast on a given pastel bg.
function titleColorFor(bg) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L > 0.55 ? '#14141c' : '#f5f5fa';
}

// Default artwork when a game has no thumb/cover — a tiny arcade cabinet grid.
const CABINET = {
  grid: [
    '..kkkkkkkk..',
    '.kssssssssk.',
    '.kscccccsk.k',
    '.kscwwwcsk..',
    '.kscccccsk..',
    '.ksssssssk..',
    '.ksbbbbbsk..',
    '.kssssssssk.',
    '.ksgg..ggsk.',
    '.kssssssssk.',
    '..kkkkkkkk..',
    '..k......k..',
  ],
  map: {
    '.': null, k: '#1a1c2c', s: '#566c86', c: '#73eff7',
    w: '#f4f4f4', b: '#3b5dc9', g: '#38b764',
  },
};

/**
 * PixelGrid { grid, map } → inline crisp SVG (one <rect> per non-null cell).
 * 1.02 overdraw kills hairline seams when CSS scales the SVG up.
 */
export function gridToSvg(thumb, { className = 'card-art' } = {}) {
  const rows = thumb.grid;
  const h = rows.length;
  const w = h ? rows[0].length : 0;
  let rects = '';
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const color = thumb.map[row[x]];
      if (!color) continue;
      rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${escapeHtml(color)}"/>`;
    }
  }
  return (
    `<svg class="${className}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" ` +
    `shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">` +
    rects +
    `</svg>`
  );
}

function renderCard(game, i) {
  const bg = pastel(i);
  const fg = titleColorFor(bg);
  const index = String(i + 1).padStart(2, '0');
  const tag = (game.tags && game.tags[0] ? game.tags[0] : '').toUpperCase();
  // `art` is pre-rendered HTML (inline SVG, or <img> for a committed cover).
  const art = game.art || gridToSvg(CABINET);
  const aria = game.description
    ? `${game.title} — ${game.description}`
    : game.title;

  return `      <a class="card" href="${escapeHtml(game.href)}" style="--bg:${bg};--fg:${fg}" aria-label="${escapeHtml(aria)}">
        <div class="card-head"><span class="card-title">${escapeHtml(game.title)}</span></div>
        <div class="card-meta"><span class="card-index">${index}</span><span class="card-tag">${escapeHtml(tag)}</span></div>
        <div class="card-artwrap">${art}</div>
      </a>`;
}

/** Render the full hub document. */
export function renderHub({ games, title = 'PHASER ARCADE' }) {
  const cards = games.map(renderCard).join('\n');
  const n = games.length;
  // Highlight the middle two letters of the wordmark green, like the reference.
  const wm = title.split('');
  const a = Math.max(0, Math.floor(wm.length / 2) - 1);
  const word = wm
    .map((ch, idx) =>
      idx >= a && idx < a + 2 && ch !== ' ' ? `<span class="hl">${escapeHtml(ch)}</span>` : escapeHtml(ch),
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="A collection of games built with Phaser 4." />
    <link
      rel="icon"
      href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
    />
    <style>
      :root { color-scheme: dark; --pixel: ui-monospace, 'Courier New', monospace; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(1200px 600px at 50% -10%, #161a2e 0%, #0a0a14 60%) ,
          #0a0a14;
        color: #e8e8f0;
        font-family: var(--pixel);
        letter-spacing: 0.02em;
        padding: clamp(20px, 4vw, 40px) clamp(12px, 3vw, 28px) 60px;
      }
      /* CRT scanline overlay — pure CSS, sits above everything, ignores pointer. */
      body::after {
        content: '';
        position: fixed; inset: 0; pointer-events: none; z-index: 9;
        background: repeating-linear-gradient(
          to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,0) 2px,
          rgba(0,0,0,0.16) 3px, rgba(0,0,0,0) 4px);
        mix-blend-mode: multiply;
      }
      @keyframes wm-glow {
        0%,100% { text-shadow: 0 0 4px rgba(124,245,155,0.0); }
        50%     { text-shadow: 0 0 10px rgba(124,245,155,0.55); }
      }
      @keyframes art-float {
        0%,100% { transform: translateY(0); }
        50%     { transform: translateY(-5px); }
      }
      header {
        max-width: 1280px;
        margin: 0 auto 28px;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px;
      }
      .logo {
        font-size: 10px;
        line-height: 1.3;
        letter-spacing: 0.18em;
        font-weight: 700;
        color: #8a90b0;
        text-transform: uppercase;
      }
      .wordmark {
        justify-self: center;
        background: #15151f;
        border: 1px solid #232336;
        border-radius: 999px;
        padding: 0.55rem 1.5rem;
        font-weight: 800;
        font-size: clamp(20px, 3.4vw, 30px);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .wordmark { animation: wm-glow 2.6s ease-in-out infinite; }
      .wordmark .hl { color: #7cf59b; }
      .menu {
        justify-self: end;
        display: inline-flex;
        flex-direction: column;
        gap: 3px;
      }
      .menu span {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #4a4f6e;
      }
      .sub {
        grid-column: 1 / -1;
        text-align: center;
        color: #6a7090;
        font-size: 12px;
        letter-spacing: 0.05em;
        margin-top: 2px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 14px;
        max-width: 1280px;
        margin: 0 auto;
      }
      .card {
        background: var(--bg);
        color: var(--fg);
        border-radius: 14px;
        padding: 14px 14px 10px;
        aspect-ratio: 3 / 4;
        display: flex;
        flex-direction: column;
        gap: 6px;
        text-decoration: none;
        position: relative;
        /* chunky pixel-frame border instead of a soft inset */
        box-shadow: 0 0 0 3px #14141c, 0 0 0 5px var(--bg);
        transition: transform 0.1s steps(2), box-shadow 0.1s ease, filter 0.1s ease;
      }
      .card:hover,
      .card:focus-visible {
        transform: translateY(-6px) scale(1.02);
        filter: brightness(1.08);
        box-shadow: 0 0 0 3px #14141c, 0 0 0 5px var(--bg),
                    0 12px 30px rgba(0,0,0,0.55), 0 0 22px 2px var(--bg);
        z-index: 2;
      }
      :focus-visible { outline: 3px solid #7cf59b; outline-offset: 2px; }
      .card-title {
        font-weight: 800;
        font-size: clamp(13px, 1.4vw, 16px);
        text-transform: uppercase;
        letter-spacing: 0.02em;
        line-height: 1.05;
      }
      .card-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.08em;
        opacity: 0.7;
      }
      .card-index {
        font-variant-numeric: tabular-nums;
        background: rgba(0, 0, 0, 0.12);
        border-radius: 4px;
        padding: 1px 5px;
      }
      .card-artwrap {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 2px;
      }
      .card-art {
        width: 86%;
        height: 86%;
        image-rendering: pixelated; /* crisp pixel thumbs */
        object-fit: contain;
        animation: art-float 3.2s ease-in-out infinite;
      }
      /* stagger the float so the cards don't bob in lockstep */
      .card:nth-child(2n) .card-art { animation-delay: -1.1s; }
      .card:nth-child(3n) .card-art { animation-delay: -2.0s; }
      img.card-art { image-rendering: pixelated; }
      footer {
        max-width: 1280px;
        margin: 36px auto 0;
        text-align: center;
        color: #4a4f6e;
        font-size: 11px;
      }
      @media (prefers-reduced-motion: reduce) {
        .card { transition: none; }
        .card:hover, .card:focus-visible { transform: none; }
        .wordmark, .card-art { animation: none; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="logo">Phaser<br />Arcade</div>
      <div class="wordmark">${word}</div>
      <div class="menu" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="sub">${n} game${n === 1 ? '' : 's'} · click to play</p>
    </header>
    <main class="grid">
${cards}
    </main>
    <footer>Built with Phaser 4 · Vite · TypeScript</footer>
  </body>
</html>
`;
}
