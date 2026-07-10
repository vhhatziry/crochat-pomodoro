/**
 * Builds the app icon source (512x512) from the extracted duck-heart sprite on
 * a cozy rounded green background, then it can be fed to `tauri icon`.
 *
 *   node tools/gen-icon.mjs
 *   pnpm tauri icon src-tauri/icons/icon-source.png
 */
import { decodePNG, encodePNG } from "./lib-png.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = 512;

const data = Buffer.alloc(SIZE * SIZE * 4);
const set = (x, y, r, g, b, a = 255) => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
};

// Rounded-rect green background with a soft vertical gradient.
const radius = 96;
const inRounded = (x, y) => {
  const inX = x >= radius && x < SIZE - radius;
  const inY = y >= radius && y < SIZE - radius;
  if (inX || inY) return true;
  const cx = x < radius ? radius : SIZE - radius;
  const cy = y < radius ? radius : SIZE - radius;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
};
for (let y = 0; y < SIZE; y++) {
  const t = y / SIZE;
  const r = Math.round(0xa6 + (0x7c - 0xa6) * t);
  const g = Math.round(0xdd + (0xc2 - 0xdd) * t);
  const b = Math.round(0x72 + (0x47 - 0x72) * t);
  for (let x = 0; x < SIZE; x++) if (inRounded(x, y)) set(x, y, r, g, b);
}

// Blit the duck-heart, nearest-neighbor scaled so it stays pixel-crisp.
const heart = decodePNG(join(ROOT, "src", "assets", "sprites", "heart.png"));
const target = 372; // heart bounding box on the icon
const scale = target / Math.max(heart.w, heart.h);
const dw = Math.round(heart.w * scale);
const dh = Math.round(heart.h * scale);
const ox = Math.round((SIZE - dw) / 2);
const oy = Math.round((SIZE - dh) / 2) + 6;
for (let y = 0; y < dh; y++) {
  const sy = Math.min(heart.h - 1, Math.floor(y / scale));
  for (let x = 0; x < dw; x++) {
    const sx = Math.min(heart.w - 1, Math.floor(x / scale));
    const si = (sy * heart.w + sx) * 4;
    if (heart.data[si + 3] < 24) continue;
    set(ox + x, oy + y, heart.data[si], heart.data[si + 1], heart.data[si + 2], 255);
  }
}

encodePNG(join(ROOT, "src-tauri", "icons", "icon-source.png"), SIZE, SIZE, data);
console.log("wrote src-tauri/icons/icon-source.png (512x512)");
