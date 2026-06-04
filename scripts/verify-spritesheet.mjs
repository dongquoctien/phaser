#!/usr/bin/env node
// verify-spritesheet.mjs — generate a standalone Phaser preview page for a cut
// atlas (the output of slice-spritesheet.mjs) so the result can be auto-verified
// in a real browser BEFORE it's wired into a game.
//
// Why: slice-spritesheet.mjs emits an atlas PNG + atlas JSON + anims JSON, and
// `--debug` lets you eyeball the STATIC detection. But "do the animations actually
// PLAY in Phaser?" can only be answered by loading them in the engine. This script
// writes a self-contained `preview.html` next to the atlas that loads it via
// `load.atlas` + registers every emitted animation (the exact recipe a game uses)
// and lays each anim out in a labeled grid, looping. It also exposes hooks on
// `window` so a browser driver (Playwright / chrome-devtools MCP) can assert:
//   - window.__SS_READY__      -> true once create() finished
//   - window.__SS_ANIMS__      -> number of animations registered
//   - window.__SS_FRAME_SIG()  -> a string signature of the CURRENT frame of every
//                                 sprite; call it twice ~400ms apart — if it CHANGES,
//                                 the animations are advancing (proof of playback).
//
// This script does NOT drive the browser itself (the repo uses MCP for that, like
// phaser-smoketest — there is no Playwright npm dep). It prepares the page + serves
// it; the skill's "Verify" step navigates via MCP and runs the asserts. If `serve`
// is available it starts a static server for you.
//
// Usage:
//   node scripts/verify-spritesheet.mjs <cut-out-dir> [--name <key>] [--port 5199]
//                                       [--serve] [--cols 4] [--cell 150]
//   <cut-out-dir>  the --out dir you passed to slice-spritesheet.mjs (has <name>.png
//                  + <name>.json + <name>.anims.json)
//   --name         base key if it can't be inferred from the dir's *.json
//   --serve        print the `npx serve` command to run (advisory; the script does
//                  NOT spawn it — start it yourself in a background shell)
//
// Example:
//   node scripts/slice-spritesheet.mjs Anzu.png --name anzu --out .cut/anzu --anchor bottom
//   node scripts/verify-spritesheet.mjs .cut/anzu --serve
//   # -> open http://localhost:5199/preview.html  (or drive it via MCP — see SKILL)

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);
const dir = argv[0];
if (!dir || dir.startsWith('--')) { console.error('usage: node scripts/verify-spritesheet.mjs <cut-out-dir> [--serve] [--port N]'); process.exit(1); }

// infer base name from the atlas json in the dir (the one with a sibling .anims.json)
let NAME = flag('name', null);
if (!NAME) {
  const animsFile = readdirSync(dir).find((f) => f.endsWith('.anims.json'));
  if (!animsFile) { console.error(`no *.anims.json in ${dir} — did slice-spritesheet.mjs run with --out ${dir}?`); process.exit(2); }
  NAME = animsFile.replace(/\.anims\.json$/, '');
}
const PORT = +flag('port', 5199);
const COLS = +flag('cols', 4);
const CELL = +flag('cell', 150);

// sanity: the three files must exist
for (const ext of ['.png', '.json', '.anims.json']) {
  try { readFileSync(join(dir, NAME + ext)); }
  catch { console.error(`missing ${NAME}${ext} in ${dir}`); process.exit(2); }
}
const tile = (() => {
  const atlas = JSON.parse(readFileSync(join(dir, NAME + '.json'), 'utf8'));
  const f = atlas.textures?.[0]?.frames?.[0]?.frame;
  return f ? f.w : 64;
})();
// how many animations + whether any has >1 frame (so we size the grid correctly and
// know whether the "frames advanced" assert is even meaningful — see __SS_PLAYING)
const animDefs = JSON.parse(readFileSync(join(dir, NAME + '.anims.json'), 'utf8'));
const ANIM_COUNT = animDefs.length;
const MULTIFRAME = animDefs.filter((d) => d.frames.length > 1).length;
const GRID_ROWS = Math.max(1, Math.ceil(ANIM_COUNT / COLS));

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>verify ${NAME}</title>
<style>
  html,body{margin:0;background:#1b1b24;color:#d8d8e0;font-family:system-ui,sans-serif}
  h1{font-size:14px;font-weight:600;padding:10px 14px 0;margin:0}
  p{font-size:12px;color:#8a8a99;padding:2px 14px 8px;margin:0}
  #game{padding:6px 14px 14px}canvas{image-rendering:pixelated}
</style></head><body>
<h1>verify-spritesheet → ${NAME} (live Phaser)</h1>
<p>Loaded via load.atlas + anims.create from the emitted JSON. Every cell loops one animation.</p>
<div id="game"></div>
<script src="https://cdn.jsdelivr.net/npm/phaser@4.1.0/dist/phaser.min.js"></script>
<script>
const NAME=${JSON.stringify(NAME)}, TILE=${tile}, COLS=${COLS}, CELL=${CELL}, PAD=8, LABEL_H=22;
class V extends Phaser.Scene{
  preload(){ this.load.atlas(NAME, NAME+'.png', NAME+'.json'); this.load.json(NAME+'-anims', NAME+'.anims.json'); }
  create(){
    const defs=this.cache.json.get(NAME+'-anims'); this.sprites=[];
    for(const d of defs){ const key=NAME+'-'+d.key; if(this.anims.exists(key))continue;
      this.anims.create({key,frames:d.frames.map(f=>({key:NAME,frame:f})),frameRate:d.frameRate,repeat:-1}); }
    defs.forEach((d,i)=>{
      const cx=PAD+(i%COLS)*(CELL+PAD)+CELL/2, cy=PAD+Math.floor(i/COLS)*(CELL+PAD)+(CELL-LABEL_H)/2;
      this.add.rectangle(cx,cy+LABEL_H/2,CELL,CELL,0x262633).setStrokeStyle(1,0x3a3a4a);
      const spr=this.add.sprite(cx,cy+LABEL_H/2,NAME,d.frames[0]);
      spr.setScale(Math.max(1,Math.floor((CELL-30)/TILE*100)/100));
      spr.play(NAME+'-'+d.key); this.sprites.push(spr);
      this.add.text(cx,cy+CELL/2,d.key+'  ('+d.frames.length+'f)',{fontFamily:'monospace',fontSize:'12px',color:'#a8e063'}).setOrigin(0.5,1);
    });
    window.__SS_READY__=true; window.__SS_ANIMS__=defs.length;
    window.__SS_MULTIFRAME__=${MULTIFRAME}; // # of anims with >1 frame (advance is testable)
    // signature = the index of the current frame within each anim, per sprite. Using
    // the index (not the texture-frame name) means a multi-frame anim that loops back
    // to frame 0 still produces a different signature mid-cycle; a single-frame anim
    // is just always 0 (and is excluded from the "playing" verdict below).
    window.__SS_FRAME_SIG=()=>this.sprites.map(s=>{const a=s.anims;return a&&a.currentFrame?a.currentFrame.index:-1;}).join('|');
    // convenience: returns {advanced, playing, multiframe}. "playing" is the verdict
    // to assert -- TRUE when frames advanced OR there were no multi-frame anims to test
    // (an all-single-frame cut cannot "advance" and that is not a failure).
    window.__SS_PLAYING=async(ms)=>{const s1=window.__SS_FRAME_SIG();await new Promise(r=>setTimeout(r,ms||450));const s2=window.__SS_FRAME_SIG();const advanced=s1!==s2;return{advanced,multiframe:window.__SS_MULTIFRAME__,playing:advanced||window.__SS_MULTIFRAME__===0};};
  }
}
window.__SS_GAME__=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:PAD+COLS*(CELL+PAD),height:PAD+${GRID_ROWS}*(CELL+PAD),backgroundColor:'#1b1b24',pixelArt:true,scene:V});
</script></body></html>`;

const outPath = join(dir, 'preview.html');
writeFileSync(outPath, html);
console.log(`wrote ${outPath}  (${ANIM_COUNT} anims, ${MULTIFRAME} multi-frame, tile ${tile}px)`);
console.log(`open  http://localhost:${PORT}/preview.html`);
console.log(`asserts: __SS_READY__ === true ; __SS_ANIMS__ === ${ANIM_COUNT} ; (await __SS_PLAYING(450)).playing === true`);
if (MULTIFRAME === 0) console.log('note: every anim is single-frame — "advanced" will be false; .playing stays true (not a failure).');

// To serve: run this yourself in a BACKGROUND shell (don't let the script own the
// server — spawning a detached `npx serve` is flaky across platforms, esp. the
// Windows .cmd shim, and an orphaned server is worse than an explicit command).
// The caller (or the skill's MCP step) starts it, navigates, asserts, then stops it.
const serveCmd = `npx --yes serve -l ${PORT} "${dir}"`;
console.log(`serve it:  ${serveCmd}`);
console.log(`  then navigate to  http://localhost:${PORT}/preview.html  and run the asserts above.`);
if (has('serve')) console.log('  (--serve is advisory: start the command above in a background shell.)');
