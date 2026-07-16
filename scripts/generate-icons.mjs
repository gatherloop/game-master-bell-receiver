// Generates the PWA icon set as flat PNGs without any external image
// dependency (no ImageMagick/sharp in this environment) — a small pixel
// rasterizer + hand-rolled PNG encoder using only Node's built-in zlib.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public");
mkdirSync(outDir, { recursive: true });

// Palette shared with the bell app's favicon for brand consistency.
const COLORS = {
  bg: [0xff, 0xfa, 0xf0, 0xff],
  handle: [0xd9, 0x8f, 0x1f, 0xff],
  body: [0xf5, 0xb9, 0x42, 0xff],
  highlight: [0xff, 0xe9, 0xa8, 0xff],
  rim: [0xd9, 0x8f, 0x1f, 0xff],
  stem: [0x8a, 0x5a, 0x12, 0xff],
  clapper: [0x8a, 0x5a, 0x12, 0xff],
  transparent: [0, 0, 0, 0],
};

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function inRoundedRect(x, y, rx0, ry0, w, h, r) {
  if (x < rx0 || x > rx0 + w || y < ry0 || y > ry0 + h) return false;
  const cx = Math.min(Math.max(x, rx0 + r), rx0 + w - r);
  const cy = Math.min(Math.max(y, ry0 + r), ry0 + h - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// Point-in-polygon (ray casting) for the bell's lower flare.
function inPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const flarePoints = [
  [20, 40],
  [44, 40],
  [49, 47],
  [15, 47],
];

// Samples the icon at 64x64 viewBox coordinates (x, y) and returns an RGBA color.
function sampleIcon(x, y, { maskable }) {
  if (!maskable && !inCircle(x, y, 32, 32, 32)) return COLORS.transparent;

  if (inCircle(x, y, 32, 56.5, 4.3)) return COLORS.clapper;
  if (inRoundedRect(x, y, 30.5, 47, 3, 7, 0)) return COLORS.stem;
  if (inEllipse(x, y, 32, 47, 17, 3.4)) return COLORS.rim;
  const inDome = y <= 40 && inEllipse(x, y, 32, 40, 12, 27);
  if (inDome || inPolygon(x, y, flarePoints)) {
    if (inEllipse(x, y, 30, 24, 9.5, 7.5)) return COLORS.highlight;
    return COLORS.body;
  }
  if (inRoundedRect(x, y, 27, 6, 10, 11, 3)) return COLORS.handle;

  return COLORS.bg;
}

function renderIcon(size, { maskable = false } = {}) {
  const pixels = new Uint8Array(size * size * 4);
  // Maskable icons need the artwork inset into the safe zone (~80% of the
  // canvas) since launchers may crop to a circle.
  const scale = maskable ? 0.7 : 1;
  const offset = (64 - 64 * scale) / 2;
  const samplesPerAxis = 3;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samplesPerAxis; sy++) {
        for (let sx = 0; sx < samplesPerAxis; sx++) {
          const fx = (px + (sx + 0.5) / samplesPerAxis) / size;
          const fy = (py + (sy + 0.5) / samplesPerAxis) / size;
          const vx = (fx * 64 - offset) / scale;
          const vy = (fy * 64 - offset) / scale;
          const bgColor = maskable ? COLORS.bg : COLORS.transparent;
          const color =
            vx < 0 || vx > 64 || vy < 0 || vy > 64 ? bgColor : sampleIcon(vx, vy, { maskable });
          r += color[0];
          g += color[1];
          b += color[2];
          a += color[3];
        }
      }
      const n = samplesPerAxis * samplesPerAxis;
      const idx = (py * size + px) * 4;
      pixels[idx] = Math.round(r / n);
      pixels[idx + 1] = Math.round(g / n);
      pixels[idx + 2] = Math.round(b / n);
      pixels[idx + 3] = Math.round(a / n);
    }
  }
  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(pixels, size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk("IHDR", ihdrData);

  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter: none
    raw.set(pixels.subarray(y * size * 4, (y + 1) * size * 4), rowStart + 1);
  }
  const idat = chunk("IDAT", deflateSync(raw, { level: 9 }));
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function writeIcon(name, size, opts) {
  const pixels = renderIcon(size, opts);
  const png = encodePng(pixels, size);
  writeFileSync(path.join(outDir, name), png);
  console.log(`wrote ${name} (${size}x${size})`);
}

writeIcon("favicon-16x16.png", 16);
writeIcon("favicon-32x32.png", 32);
writeIcon("apple-touch-icon.png", 180);
writeIcon("icon-192.png", 192);
writeIcon("icon-512.png", 512);
writeIcon("icon-maskable-512.png", 512, { maskable: true });
