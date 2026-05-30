# Pixel-art skill — sources

The `pixel-art` skill and `src/pixel/` helper are distilled from these public
references (researched 2026-05). Listed for traceability. New code authored from
these sources — not copied from any other project.

## Colour, ramps, hue-shifting
- SLYNYRD — Pixelblog #1, Color Palettes (ramps, ~20–45° hue shift, saturation):
  https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes
  (mirror: https://lospec.com/pixel-art-tutorials/pixelblog-1-color-palettes-by-slynyrd)
- Lospec — Palette List + Sweetie-16 (CC0 palette this project standardizes on):
  https://lospec.com/palette-list · https://lospec.com/palette-list/sweetie-16
- Lospec — hue-shifting / palette tutorial tags:
  https://lospec.com/pixel-art-tutorials/tags/hueshifting

## Shading, outlines, form
- SLYNYRD — Pixelblog #5, Back to Basics (integer scaling, no-AA, canvas size):
  https://www.slynyrd.com/blog/2018/5/16/pixelblog-5-back-to-basics
- SLYNYRD — Pixelblog #6, Light and Shadow (one light direction):
  https://www.slynyrd.com/blog/2018/6/15/pixelblog-6-light-and-shadow
- Saint11 / Pedro Medeiros — tutorials index (selective outline, shading, AA):
  https://saint11.art/blog/pixel-art-tutorials/
- Lospec — Pixel Art Outlines (black vs selective/"selout"):
  https://lospec.com/articles/pixel-art-outlines/
- Derek Yu — Pixel Art Common Mistakes (pillow shading, silhouettes):
  https://www.derekyu.com/makegames/pixelart2.html

## Phaser crisp-render + procedural textures
- Official Phaser Pixel-Art Guide:
  https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Pixel%20Art%20Guide/Phaser%204%20Pixel%20Art%20Guide.md
- Phaser docs — Textures / generateTexture / Textures.generate (indexed palette,
  '.' = transparent), `pixelArt` config:
  https://docs.phaser.io/phaser/concepts/textures ·
  https://newdocs.phaser.io/docs/3.55.2/focus/Phaser.GameObjects.Graphics-generateTexture
- Belén Albeza — Retro, crisp pixel art in Phaser (nearest-neighbor, integer scale):
  https://www.belenalbeza.com/articles/retro-crisp-pixel-art-in-phaser/
