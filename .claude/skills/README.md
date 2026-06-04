# Phaser Monorepo Skills

A set of project skills for building **Phaser 4.1.0 + Vite + TypeScript** pixel-art
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
| **phaser-audio** | Thêm âm thanh: research SFX/nhạc CC0 (Kenney/freesound) trước → load → helper `Audio` (throttle theo key, mute persist registry, xử lý WebAudio autoplay-unlock + guard cache trước decode). Trigger: "âm thanh", "tiếng", "SFX", "nhạc nền", "thiếu tiếng". Two mandatory bug boxes: iOS Ogg-silence (ship `.m4a`), and **sound stacking/blasting on tab return** (`pauseOnBlur=false` + a `pageHidden` flag). |
| **phaser-ui-ux** | Correct, bug-free in-game UI/UX: modals that actually block input underneath (a scene-handler guard flag, not just an interactive dim), scrollable lists (tween radius ≠ scale, header occluded by add-order, scroll-arrows, drag-vs-tap), pre-select the last pick (not random) + reset per-run, ground-plane perspective (rotate inside a scaleY container), text entry via a hidden DOM input, depth/draw-order. Trigger: add/fix any popup/picker/menu/leaderboard/tutorial, or UI that "lets clicks through", "scrolls wrong", "header disappears", "input won't type", "effect looks tilted", "picks random". |
| **game-design** | Thiết kế **cảm giác** game (không phải kỹ thuật): core loop & pacing, juice (screen shake, hit-stop, squash/stretch, particle, color flash, damage numbers), 12 nguyên tắc animation + frame timing, **VFX/effect anatomy** (additive vs alpha blend, explosion/spell theo phase), sound feedback, telegraph/readability của enemy, onboarding, **đọc/đảo-ngược game từ ảnh reference** (deconstruct screenshot → mechanics), **suy luận cốt truyện/theme từ thể loại**. Trigger: game "nhạt / flat / không có chiều sâu / thiếu cảm giác", làm combat/feedback/effect, lên kế hoạch loop game mới, hoặc phân tích ảnh mẫu. Có `sources.md` (Juice-it-or-lose-it, 12 principles, GDC telegraphing, sound-design, VFX, sprite-animation timing, image-reverse-engineering, narrative/lore). |

## Stack quy ước
- **Phaser 4.1.0** (đã nâng từ 3.90; v4 renderer mới. Lưu ý: v4 bỏ `Textures.generate`+Create Palettes, `roundPixels` default `false` → đã set explicit `roundPixels: true`).
- **Vite 5 + TypeScript 5 (strict)**, npm workspaces.
- Cấu trúc monorepo: `games/<name>/` tự chứa; root chia sẻ `vite.config.shared.mjs` + `tsconfig.base.json`.

## Templates
`phaser-new-game/templates/` chứa code thật sẵn để copy:
- `root/` — package.json (workspaces), tsconfig.base.json, vite.config.shared.mjs (đã tune production), **scripts/build-all.mjs + scripts/hub-template.mjs** (sinh hub HTML tĩnh), **src/pixel/** (helper pixel-art).
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
- **Windows**: chạy `build:all` qua PowerShell (Git Bash mangle `/` → MSYS path). Base truyền qua env `GAME_BASE`, không phải CLI `--base /`.

**Hub design** (`scripts/hub-template.mjs`): **HTML/CSS tĩnh** (không phải Phaser) — grid card pastel kiểu "COLLECTION" trên nền tối, mỗi game 1 card (responsive auto 1→6 cột, màu xoay vòng). Header pill "PHASER ARCADE". Artwork card = pixel `thumb` render thành **inline SVG** (ưu tiên `cover.svg`/`cover.png` thủ công nếu có). Card là `<a>` thật → crawlable, **zero JS**, focus-visible, không emoji.
