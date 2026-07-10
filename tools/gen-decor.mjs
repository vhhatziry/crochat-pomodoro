/**
 * Regenerates ONLY the decorative background tiles (clover + tulip) to match
 * the reference art palette. Leaves the extracted duck-heart sprite untouched.
 *
 *   node tools/gen-decor.mjs
 */
import { encodePNG } from "./lib-png.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "sprites");

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.data = Buffer.alloc(w * h * 4); }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2];
    this.data[i + 3] = c.length > 3 ? c[3] : 255;
  }
  disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r + r * 0.5) this.set(cx + x, cy + y, c);
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
}

// Sampled from the reference art.
const CLOVER = {
  edge: [74, 132, 40],   // dark leaf outline
  mid: [110, 176, 66],   // leaf body
  light: [150, 208, 104], // highlight
  stem: [96, 150, 58],
};
const TULIP = {
  edge: [138, 96, 157],  // petal outline
  mid: [170, 130, 190],  // petal body
  light: [198, 165, 214], // highlight
  stem: [126, 150, 110],
};

// Four-leaf clover, two-tone with a curled stem.
function renderClover() {
  const cv = new Canvas(28, 28);
  const lobes = [
    [14, 8], [8, 14], [20, 14], [14, 20],
  ];
  for (const [x, y] of lobes) cv.disc(x, y, 6, CLOVER.edge);
  for (const [x, y] of lobes) cv.disc(x, y, 5, CLOVER.mid);
  for (const [x, y] of lobes) cv.disc(x - 1, y - 1, 2, CLOVER.light);
  // little notch to read as heart-leaves
  cv.set(14, 14, CLOVER.edge);
  // stem
  for (let i = 0; i < 6; i++) cv.set(14 + (i > 3 ? 1 : 0), 21 + i, CLOVER.stem);
  return cv;
}

// Simple cozy tulip: 3-petal head, stem, two leaves.
function renderTulip() {
  const cv = new Canvas(28, 28);
  // head (three rounded petals)
  cv.disc(14, 9, 6, TULIP.edge);
  cv.disc(14, 9, 5, TULIP.mid);
  cv.disc(10, 8, 3, TULIP.mid);
  cv.disc(18, 8, 3, TULIP.mid);
  // petal separations
  cv.rect(13, 5, 1, 7, TULIP.edge);
  cv.rect(10, 6, 1, 5, TULIP.edge);
  cv.rect(17, 6, 1, 5, TULIP.edge);
  // highlight
  cv.disc(11, 7, 1, TULIP.light);
  // stem
  cv.rect(13, 13, 2, 11, TULIP.stem);
  // leaves
  cv.disc(9, 18, 3, TULIP.stem);
  cv.disc(19, 20, 3, TULIP.stem);
  cv.set(9, 18, TULIP.mid);
  cv.set(19, 20, TULIP.mid);
  return cv;
}

console.log("Regenerating decor →", OUT);
encodePNG(join(OUT, "clover.png"), 28, 28, renderClover().data);
console.log("  wrote clover.png (28x28)");
encodePNG(join(OUT, "flower.png"), 28, 28, renderTulip().data);
console.log("  wrote flower.png (28x28)");
console.log("Done.");
