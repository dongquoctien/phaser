// Transcode every games/<game>/public/audio/*.ogg → a sibling *.m4a (AAC).
//
// WHY: iOS Safari (iPhone/iPad) cannot decode Ogg Vorbis, so an Ogg-only game is
// SILENT on Apple devices. Shipping an AAC/.m4a alongside each .ogg lets Phaser
// pick a format the browser supports (load.audio(key, [ogg, m4a])).
//
// Idempotent: skips a .m4a that's already newer than its .ogg. Uses the bundled
// ffmpeg-static binary (no system ffmpeg needed).
//
//   node scripts/ogg-to-m4a.mjs

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static'); // path to the binary

const gamesDir = 'games';
let made = 0,
  skipped = 0;

for (const game of readdirSync(gamesDir)) {
  const audioDir = join(gamesDir, game, 'public', 'audio');
  if (!existsSync(audioDir)) continue;
  for (const f of readdirSync(audioDir)) {
    if (!f.endsWith('.ogg')) continue;
    const ogg = join(audioDir, f);
    const m4a = ogg.replace(/\.ogg$/, '.m4a');
    if (existsSync(m4a) && statSync(m4a).mtimeMs >= statSync(ogg).mtimeMs) {
      skipped++;
      continue;
    }
    // AAC LC, 128k, mono-friendly; -y overwrites. Quiet logs.
    execFileSync(
      ffmpeg,
      ['-y', '-loglevel', 'error', '-i', ogg, '-c:a', 'aac', '-b:a', '128k', m4a],
      { stdio: 'inherit' },
    );
    made++;
    console.log(`  ✓ ${game}/${f} → ${f.replace(/\.ogg$/, '.m4a')}`);
  }
}

console.log(`\nDone: ${made} converted, ${skipped} up-to-date.`);
