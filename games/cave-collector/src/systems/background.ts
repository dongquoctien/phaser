import Phaser from 'phaser';

// Layered parallax cave background, themed to the source frames: a deep teal
// base, a glowing green "toxic" band across the top with hanging stalactites,
// and a darker midground silhouette. Drawn once into RenderTextures so it costs
// almost nothing per frame. Far layers scroll slower than the camera (parallax).
export function buildBackground(scene: Phaser.Scene, worldW: number, worldH: number): void {
  // Base fill (scrollFactor 0 — always covers the viewport).
  const base = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x142a2c);
  base.setOrigin(0, 0).setScrollFactor(0).setDepth(-100);

  // FAR layer: glowing green toxic band + soft blobs, slow parallax.
  const far = scene.add.graphics().setDepth(-90).setScrollFactor(0.3);
  far.fillStyle(0x2f8f5a, 1);
  far.fillRect(0, 0, worldW, 70);
  far.fillStyle(0x3fae6c, 0.6);
  for (let x = 0; x < worldW; x += 28) {
    const h = 50 + ((x * 7) % 40);
    far.fillTriangle(x, 0, x + 14, h, x + 28, 0); // hanging stalactite shapes
  }
  far.fillStyle(0x1d4f57, 0.5);
  for (let x = 0; x < worldW; x += 48) {
    const h = worldH - (40 + ((x * 11) % 60));
    far.fillTriangle(x, worldH, x + 24, h, x + 48, worldH); // floor stalagmites
  }

  // MID layer: darker silhouette pillars, medium parallax.
  const mid = scene.add.graphics().setDepth(-80).setScrollFactor(0.6);
  mid.fillStyle(0x18383c, 0.8);
  for (let x = 16; x < worldW; x += 96) {
    mid.fillRect(x, 60, 22, worldH - 60);
  }
  mid.fillStyle(0x214a4f, 0.5);
  for (let x = 60; x < worldW; x += 96) {
    mid.fillRect(x, 90, 14, worldH - 90);
  }

  // A subtle vignette / cave-edge darkening at the very top stalactite tips.
  const tips = scene.add.graphics().setDepth(-85).setScrollFactor(0.3);
  tips.fillStyle(0x143f2c, 0.7);
  for (let x = 0; x < worldW; x += 20) {
    const h = 18 + ((x * 13) % 26);
    tips.fillTriangle(x, 0, x + 10, h, x + 20, 0);
  }
}
