# Phaser Monorepo Skills

A set of project skills for building **Phaser 3.90 + Vite + TypeScript** pixel-art
games in this monorepo — "chuẩn nhất, pro nhất, nhẹ nhất". Claude invokes these
automatically when your request matches, or call them with `/<name>`.

| Skill | Khi nào dùng |
|-------|--------------|
| **phaser-new-game** | Tạo/scaffold một game Phaser mới đúng chuẩn (scene Boot→Preload→Menu→Game, pixelArt config, atlas pipeline, object pool). Bootstrap luôn root tooling nếu chưa có. |
| **phaser-optimize-bundle** | Làm build nhẹ nhất: pack atlas, nén PNG/audio, Vite/Rollup tree-shaking + tách chunk Phaser, terser. Đo before/after. |
| **phaser-perf-audit** | Chạy mượt nhất (FPS/giật): object pooling, khử cấp phát trong game loop, batching draw call, Arcade physics, cull off-screen. |
| **phaser-review** | Review code game theo convention pro: scene structure, key constants, pooling, dọn listener lúc shutdown, TS strict. |
| **phaser-smoketest** | Autotest bằng **Playwright MCP**: boot game trong browser thật, check canvas render + console sạch + đo FPS + screenshot từng scene. Là bước verify cuối mà các skill new-game/optimize/perf-audit gọi tới. |
| **pixel-art** | Vẽ pixel-art procedural trong Phaser (game + hub): palette Sweetie-16, value ramp + hue-shift, 1 hướng sáng, outline selout, integer scale, nearest-neighbor. Dùng helper `src/pixel/` (`bakeSprite`, `ramp`, `lit`/`shade`). Trigger: "vẽ pixel/sprite", "tạo icon pixel", art "looks off / mờ". |

## Stack quy ước
- **Phaser 3.90** (Tsugumi, 5/2025 — bản v3 ổn định cuối; v4 là hướng tương lai, cân nhắc riêng).
- **Vite 5 + TypeScript 5 (strict)**, npm workspaces.
- Cấu trúc monorepo: `games/<name>/` tự chứa; root chia sẻ `vite.config.shared.mjs` + `tsconfig.base.json`.

## Templates
`phaser-new-game/templates/` chứa code thật sẵn để copy:
- `root/` — package.json (workspaces), tsconfig.base.json, vite.config.shared.mjs (đã tune production), scripts/build-all.mjs, **src/pixel/** (helper pixel-art), **hub/** (Phaser hub app + font Press Start 2P nhúng).
- `game/` — index.html, vite.config.mjs, game.json (+thumb), src/ đầy đủ (config, scenes, systems/Pool.ts, objects/PooledSprite.ts, types/keys.ts).

Mọi chính sách build/perf nằm ở file shared của root → sửa một chỗ, mọi game hưởng lợi.

## Deploy (nhiều game → 1 hub)
`npm run build:all` build mọi game trong `games/*` rồi **tự sinh trang hub** `dist/index.html` (grid chọn game) link tới từng game ở URL con. Cấu trúc:
```
dist/
├─ index.html        ← hub (landing page, liệt kê mọi game)
├─ flappy-bird/      ← /<repo>/flappy-bird/
└─ <game>/           ← /<repo>/<game>/
```
- **GitHub Pages**: `.github/workflows/deploy.yml` tự build + publish khi push `main`. Base path = `/<repo>/` (lấy tự động từ tên repo qua `BASE_PATH`). URL: `https://<user>.github.io/<repo>/`.
- **Host khác / root domain**: `BASE_PATH=/ npm run build:all`.
- Game mới **tự xuất hiện** trên hub — build-all quét `games/*`, không cần sửa tay.
- **Windows**: chạy `build:all` qua PowerShell (Git Bash mangle `/` → MSYS path). Base truyền qua env `GAME_BASE`/`HUB_BASE`, không phải CLI `--base /`.

**Hub design** (`hub/`): là **Phaser app pixel-art** (không phải HTML tĩnh) → đồng nhất với game. Font **Press Start 2P** nhúng base64 (tự chứa). Icon/thumbnail vẽ bằng `src/pixel/` (skill `pixel-art`). Mỗi card đọc `game.json` (`title`/`description`/`tags`/`thumb`); thiếu `thumb` → glyph cabinet mặc định. Card pixel bevel, focus ring, keyboard nav (mũi tên + Enter). Fallback `<ul>`/`<noscript>` crawlable cho a11y/SEO (canvas không có DOM). **Không** auto-screenshot.
