---
name: phaser-smoketest
description: Headless Playwright smoke-test for a Phaser game in this monorepo — boots the game in a real browser via Playwright MCP and asserts canvas renders, console is clean (no asset/exception errors), FPS is above threshold, and captures a screenshot per scene. Use after scaffolding/optimizing/perf-tuning a game, or when the user asks to "autotest", "playwright test", "smoke test", "kiểm thử tự động", "test game chạy được". Shared verify step the other phaser-* skills call.
---

# Phaser — Playwright Smoke-Test

The single source of truth for "did this game actually boot and run". Phaser renders to a `<canvas>`, so normal DOM assertions are useless — instead we drive a real browser with **Playwright MCP** and read the live `Phaser.Game` instance through `browser_evaluate`.

This skill is called at the end of `phaser-new-game`, `phaser-optimize-bundle`, and `phaser-perf-audit`, and can be run standalone.

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
6. **Screenshot** each reachable scene with `browser_take_screenshot` (full page); advance scenes by driving input (`browser_press_key` / clicking the start prompt) — Phaser has no DOM to click, so use keyboard or `evaluate` to call `game.scene.start(key)`.
7. **Report** a pass/fail table: boot, canvas, console, FPS (measured), and saved screenshot paths. Stop the dev server.

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
