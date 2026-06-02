---
name: phaser-smoketest
description: Headless Playwright verification for a Phaser game in this monorepo — boots the game in a real browser via Playwright MCP and asserts canvas renders, console is clean (no asset/exception errors), FPS is above threshold, the UI layout is sound (no overlapping/off-screen/unreachable interactive controls), and the core gameplay loop actually works. Captures a screenshot per scene and judges each one. Use after scaffolding/optimizing/perf-tuning a game, or when the user asks to "autotest", "playwright test", "smoke test", "verify UI", "kiểm thử tự động", "test game chạy được". Shared verify step the other phaser-* skills call.
---

# Phaser — Playwright Verification (boot + UI layout + gameplay)

The single source of truth for "did this game actually boot, render correctly, **lay out its UI without overlaps**, and **play**". Phaser renders to a `<canvas>`, so normal DOM assertions are useless — instead we drive a real browser with **Playwright MCP**, read the live `Phaser.Game` instance through `browser_evaluate`, **and look at every screenshot we take**.

This skill is called at the end of `phaser-new-game`, `phaser-optimize-bundle`, and `phaser-perf-audit`, and can be run standalone.

> **Why this skill grew teeth.** A boot+FPS-only smoke test once passed a game
> whose buy-shop overlapped the play button — green check, broken UI. A console
> with zero errors does NOT mean the screen is usable. **You MUST (a) screenshot
> every scene AND open each screenshot and judge it, and (b) run the layout probe
> that flags overlapping / off-screen / unreachable interactive controls.** A run
> that skipped either of those is not a pass — say so.

## Prerequisites
- The game builds/serves: `npm run dev:<game>` (or `npm run preview:<game>` for a prod build smoke).
- Playwright MCP tools available (`mcp__playwright__*`). If not connected, tell the user to add the Playwright MCP server and stop.
- The game must expose its instance for testing — the scaffold's `main.ts` should assign `window.__PHASER_GAME__ = new Phaser.Game(config)` when `__DEV__`. If it doesn't, add that line (dev-only) before testing.

## Procedure

1. **Start the dev server** in the background and capture the URL (Vite prints `http://localhost:5173`). Don't leave it running after the test unless asked.
2. **Navigate**: `browser_navigate` to the URL.
3. **Wait for boot**: `browser_wait_for` a short beat, then poll the readiness probe (below) via `browser_evaluate` until `booted === true` or timeout (~10s). Fail loudly if it never boots.
4. **Run the assertions** (next section) via `browser_evaluate`.
5. **Console check**: `browser_console_messages` — fail on any `error`, and on `warning`s that match asset/texture/missing-key patterns (see `assets/test-hooks.js`).
6. **Screenshot + EYEBALL each reachable scene.** `browser_take_screenshot` (full page) for every scene AND **every distinct UI state** (menu, gameplay idle, gameplay mid-action, any panel/shop/upgrade overlay, game-over/win). Advance scenes by driving input (`browser_press_key` / clicking the start prompt) — Phaser has no DOM to click, so use keyboard or `evaluate` to call `game.scene.start(key)`. **Then `Read` each screenshot back and actually judge it** (next section, "Visual judgement"). A saved-but-unviewed screenshot proves nothing.
7. **UI layout probe** (the overlap/reachability check below) on every scene that has interactive controls — especially any scene where a panel/shop/overlay appears, because that is exactly where one control ends up covering another.
8. **Gameplay-loop check** — exercise the one-sentence core loop (from `game-design`) end to end via input + dev hooks, and assert the state it should change actually changes (see "Gameplay loop" below). Boot ≠ playable.
9. **iOS audio check (if the game has sound).** Ogg-only ships a **silent iPhone** — MCP can't run Safari, but you can catch the bug statically: for every audio key, assert a **`.m4a` exists next to the `.ogg`** in `public/audio/`, and that `PreloadScene` loads `[m4a, ogg]` (m4a first). After a gesture, `game.sound.context.state` should read `running`, not `suspended`. Flag any Ogg-only key. See `phaser-audio`.
10. **Report** a pass/fail table: boot, canvas, console, FPS (measured), **UI layout (overlaps/offscreen/unreachable)**, **gameplay loop**, **audio (iOS dual-format)**, and saved screenshot paths. Stop the dev server.

## UI layout probe — catch overlapping / off-screen / unreachable controls

A clean console says nothing about whether two buttons sit on top of each other.
Run this **per scene** (pass the scene's key) via `browser_evaluate`. It walks the
scene's interactive objects, reads each one's world `getBounds()`, and flags:
**overlaps** (two visible interactive controls covering each other — the "shop over
play" bug), **offscreen** (a control wholly outside the canvas), and any control
hidden behind a higher-depth opaque panel.

```js
(sceneKey) => {
  const g = window.__PHASER_GAME__ || window.game;
  const s = g.scene.getScenes(true).find(x => x.scene.key === sceneKey);
  if (!s) return { err: 'scene not active', active: g.scene.getScenes(true).map(x=>x.scene.key) };
  const W = s.scale.width, H = s.scale.height, list = [];
  s.children.list.forEach(o => {
    if (o.input && o.input.enabled && o.getBounds) {
      const b = o.getBounds();
      list.push({ label: String(o.text||o.name||o.texture?.key||o.type).replace(/\s+/g,' ').slice(0,24),
        x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.width), h:Math.round(b.height),
        depth:o.depth, visible:o.visible });
    }
  });
  const vis = list.filter(o => o.visible);
  const overlaps = [];
  for (let i=0;i<vis.length;i++) for (let j=i+1;j<vis.length;j++){
    const a=vis[i], b=vis[j];
    const ox=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
    const oy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    if (ox>2 && oy>2) overlaps.push({ a:a.label, b:b.label, area:ox*oy });
  }
  const offscreen = vis.filter(o => o.x+o.w<0||o.y+o.h<0||o.x>W||o.y>H||o.x<0||o.y<0&&false);
  return { interactiveCount:list.length, interactive:list, overlaps, offscreen, canvas:{W,H} };
}
```

Pass criteria: **`overlaps` is empty** and **`offscreen` is empty** for every scene/state.
- A non-empty `overlaps` is a real bug — quote the two labels and which UI state triggered it (e.g. "Shop ⨯ Start Wave while the build menu is open"), then fix the layout, don't widen the threshold.
- If `interactiveCount` is suspiciously low (e.g. a visible shop reports 1), the controls may be drawn as plain Rectangles/Images with a single parent zone — **cross-check the eyeballed screenshot**: every tappable thing you can see must be reachable. Note that gap in the report.
- Re-run the probe **after** opening each overlay (build menu, upgrade panel, pause) — overlays are where controls collide.

## Gameplay loop — prove it actually plays

Boot + render + clean console is necessary, not sufficient. Drive the **core loop**
(the one sentence from `game-design`) and assert the consequence:

- Identify the loop's money/score/lives/wave/health state (read it via `browser_evaluate` off the scene, or a dev hook like `scene.__dev`).
- Perform the primary action through real input (click/tap/key, or a dev hook the scaffold exposes — e.g. `__dev.place(id,col,row)`, `__dev.startWave()`).
- Re-read the state and assert it changed in the right direction (money rose after a kill, lives dropped when an enemy leaked, score increased, the player moved).
- Screenshot the mid-action frame and eyeball it (projectiles firing, enemies on screen, feedback/juice visible).

Report what you exercised and the before→after numbers. If the scaffold lacks a dev hook to do this deterministically, add a small dev-only one (like the `__dev`/`__stress` hooks other games expose) rather than skipping the check.

## Visual judgement — what to look for in each screenshot

After `browser_take_screenshot`, **`Read` the PNG and judge it** against:
- **No overlap / occlusion**: no control or label sits on top of another; nothing important is hidden behind a panel; text isn't clipped at the canvas edge.
- **Everything on-screen**: HUD (score/lives/etc.), primary buttons, and the play field are all inside the canvas at this aspect ratio.
- **Readable**: text legible at game size; art reads as its intended silhouette; contrast against the background is enough.
- **State is correct**: the screen matches the state you drove it into (shop open shows towers; game-over shows the result; wave counter advanced).
Call out anything off explicitly with the scene/state — a screenshot you didn't actually look at is not evidence.

## What to evaluate in the browser

Copy the probe from `assets/test-hooks.js` (next to this skill) into a `browser_evaluate` call. It returns a JSON verdict:

```js
// returns { booted, sceneKeys, activeScene, canvasOk, fps, errors }
```

Pass criteria (defaults — override per request):
- **booted**: `game` exists and at least one scene is active.
- **canvasOk**: a `<canvas>` exists with width>0 / height>0 and the WebGL/Canvas renderer initialized (`game.renderer.type` set).
- **console clean**: zero `error` messages; zero asset-error warnings.
- **fps ≥ 55** measured over ~2s of running (read `game.loop.actualFps`). Lower the bar for heavy scenes only with the user's say-so.

## Reporting
Always give a concrete table and the FPS number. If anything fails, quote the exact console error / the failing assertion with the scene key — don't say "looks fine" without the measured values. On FPS failure, point the user to `phaser-perf-audit`; on missing-asset failure, point to `phaser-optimize-bundle` (atlas) or the load path.

## Scope / refuse
- This is a smoke-test (boots & runs & renders), not gameplay E2E. Don't assert game-logic outcomes here unless the user asks and provides expected states.
- Don't fake a pass: if Playwright MCP isn't available or the server didn't start, report that — never claim a green run you didn't observe.
