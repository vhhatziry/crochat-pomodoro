/**
 * Pixel-art sprite generator for CrocHat.
 *
 * Draws indexed pixel grids and encodes them as real PNGs using only Node's
 * built-in zlib (no native deps). Output goes to src/assets/sprites/.
 * These are hand-built approximations of the Figma art and can be swapped for
 * exact exports later without touching any code.
 *
 *   node tools/gen-sprites.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "assets", "sprites");
mkdirSync(OUT, { recursive: true });

// --- PNG encoder ------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- tiny drawing canvas ----------------------------------------------------

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4); // transparent
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c.length > 3 ? c[3] : 255;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r + r * 0.4) this.set(cx + x, cy + y, c);
  }
  blitScaled(src, ox, oy, s) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.data[i + 3] === 0) continue;
        const c = [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]];
        this.rect(ox + x * s, oy + y * s, s, s, c);
      }
  }
}

function save(name, canvas) {
  writeFileSync(join(OUT, name), encodePNG(canvas.w, canvas.h, canvas.data));
  console.log("  wrote", name, `(${canvas.w}x${canvas.h})`);
}

// --- palette ----------------------------------------------------------------

const C = {
  pink: [232, 155, 181],
  pinkDark: [199, 96, 130],
  pinkLight: [246, 198, 214],
  white: [255, 255, 255],
  cream: [244, 230, 205],
  creamShad: [223, 200, 165],
  ink: [74, 54, 63],
  blush: [235, 150, 170],
  leafDark: [95, 168, 60],
  leafLight: [141, 201, 92],
  stem: [110, 150, 60],
  petal: [245, 210, 232],
  petalEdge: [210, 150, 200],
  yellow: [247, 208, 92],
  tomato: [214, 69, 65],
  tomatoDark: [165, 48, 46],
  tomatoLeaf: [110, 170, 70],
  paper: [248, 244, 236],
  paperLine: [150, 170, 200],
  spiral: [90, 100, 120],
  pencilBody: [240, 180, 70],
  pencilTip: [90, 70, 60],
  pencilBlue: [70, 130, 200],
};

// --- heart + character (hero sprite) ----------------------------------------

function heartShape(cv, color, grow) {
  const lx = 11,
    rx = 20,
    ly = 12,
    r = 7 + grow;
  cv.disc(lx, ly, r, color);
  cv.disc(rx, ly, r, color);
  const top = ly,
    bottom = 29 + grow,
    cx = 15.5;
  for (let y = top; y <= bottom; y++) {
    const t = (bottom - y) / (bottom - top);
    const hw = Math.round(t * (13 + grow));
    for (let x = -hw; x <= hw; x++) cv.set(cx + x, y, color);
  }
}

function renderHeart() {
  const cv = new Canvas(32, 32);
  heartShape(cv, C.pinkDark, 1); // outline
  heartShape(cv, C.pink, 0); // fill
  // top-left pixel highlights
  for (const [x, y] of [
    [8, 7],
    [9, 7],
    [8, 8],
    [10, 6],
  ])
    cv.set(x, y, C.pinkLight);
  cv.set(9, 6, C.white);
  cv.set(8, 6, C.white);

  // character: cream face
  cv.disc(15, 14, 6, C.cream);
  // ears
  cv.disc(11, 8, 2, C.cream);
  cv.disc(20, 8, 2, C.cream);
  cv.set(11, 8, C.blush);
  cv.set(20, 8, C.blush);
  // wool tuft on top
  cv.disc(15, 8, 2, C.cream);
  cv.set(14, 7, C.white);
  cv.set(16, 7, C.white);
  // eyes
  cv.rect(12, 13, 1, 2, C.ink);
  cv.rect(18, 13, 1, 2, C.ink);
  // snout
  cv.disc(15, 17, 3, C.creamShad);
  cv.disc(15, 16, 2, C.cream);
  cv.set(15, 17, C.ink); // nose
  cv.set(14, 18, C.ink);
  cv.set(16, 18, C.ink);
  // blush cheeks
  cv.set(11, 16, C.blush);
  cv.set(19, 16, C.blush);
  return cv;
}

// --- decor: clover & flower -------------------------------------------------

function renderClover() {
  const cv = new Canvas(16, 16);
  const leaves = [
    [6, 5],
    [10, 5],
    [6, 9],
    [10, 9],
  ];
  for (const [x, y] of leaves) cv.disc(x, y, 3, C.leafDark);
  for (const [x, y] of leaves) cv.disc(x, y - 1, 2, C.leafLight);
  cv.rect(8, 9, 1, 5, C.stem); // stem
  cv.set(9, 9, C.stem);
  return cv;
}

function renderFlower() {
  const cv = new Canvas(16, 16);
  const petals = [
    [8, 4],
    [12, 8],
    [8, 12],
    [4, 8],
    [11, 5],
    [11, 11],
    [5, 11],
    [5, 5],
  ];
  for (const [x, y] of petals) cv.disc(x, y, 2, C.petalEdge);
  for (const [x, y] of petals) cv.disc(x, y, 1, C.petal);
  cv.disc(8, 8, 2, C.yellow);
  return cv;
}

// --- nav icons: tomato & notebook -------------------------------------------

function renderTomato() {
  const cv = new Canvas(20, 20);
  cv.disc(10, 12, 7, C.tomatoDark);
  cv.disc(10, 12, 6, C.tomato);
  // highlight
  cv.set(7, 8, C.white);
  cv.set(8, 8, C.white);
  cv.set(7, 9, C.pinkLight);
  // leaf/stem
  cv.rect(9, 3, 2, 3, C.tomatoLeaf);
  cv.disc(7, 5, 1, C.tomatoLeaf);
  cv.disc(13, 5, 1, C.tomatoLeaf);
  cv.disc(10, 5, 1, C.tomatoLeaf);
  return cv;
}

function renderNotebook() {
  const cv = new Canvas(20, 20);
  cv.rect(4, 3, 12, 15, C.spiral); // outer border
  cv.rect(5, 3, 11, 15, C.paper); // page
  // ruled lines
  for (let y = 6; y <= 15; y += 2) cv.rect(7, y, 7, 1, C.paperLine);
  // spiral binding
  for (let y = 4; y <= 16; y += 2) {
    cv.set(4, y, C.spiral);
    cv.set(3, y, C.spiral);
  }
  // pencil diagonal
  for (let i = 0; i < 8; i++) {
    cv.set(11 + i, 15 - i, C.pencilBody);
    cv.set(12 + i, 15 - i, C.pencilBody);
  }
  cv.set(11, 15, C.pencilTip);
  cv.set(12, 14, C.pencilTip);
  cv.set(18, 8, C.pencilBlue);
  cv.set(19, 7, C.pencilBlue);
  return cv;
}

// --- app icon (rounded bg + upscaled heart) ---------------------------------

function renderIcon() {
  const size = 512;
  const cv = new Canvas(size, size);
  const bg = C.leafLight;
  const radius = 90;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // rounded-rect mask
      const inX = x >= radius && x < size - radius;
      const inY = y >= radius && y < size - radius;
      let inside = false;
      if (inX || inY) inside = true;
      else {
        const cx = x < radius ? radius : size - radius;
        const cy = y < radius ? radius : size - radius;
        inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
      }
      if (inside) cv.set(x, y, bg);
    }
  const heart = renderHeart();
  const s = 13;
  const ox = Math.round((size - heart.w * s) / 2);
  const oy = Math.round((size - heart.h * s) / 2);
  cv.blitScaled(heart, ox, oy, s);
  return cv;
}

// --- run --------------------------------------------------------------------

console.log("Generating sprites →", OUT);
save("heart.png", renderHeart());
save("clover.png", renderClover());
save("flower.png", renderFlower());
save("tomato.png", renderTomato());
save("notebook.png", renderNotebook());

const iconsDir = join(__dirname, "..", "src-tauri", "icons");
mkdirSync(iconsDir, { recursive: true });
writeFileSync(
  join(iconsDir, "icon-source.png"),
  encodePNG(512, 512, renderIcon().data),
);
console.log("  wrote src-tauri/icons/icon-source.png (512x512)");
console.log("Done.");
