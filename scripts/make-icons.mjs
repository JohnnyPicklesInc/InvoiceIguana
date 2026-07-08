/**
 * Generates the iguana-face PNG icons (rounded dark square, no deps — zlib +
 * hand-rolled PNG chunks) for both the site (incl. PWA sizes) and the
 * extension. Run: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- scene, in unit coordinates (0..1) -------------------------------------

const BG = [22, 40, 32];        // deep forest green
const SCALE = [96, 170, 92];    // iguana green
const RIDGE = [56, 108, 62];    // darker green dorsal spikes
const DEWLAP = [206, 108, 64];  // warm orange-red throat fan
const DARK = [18, 20, 16];

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

function inRoundedSquare(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Returns [r,g,b,a] for a unit-space point. Painted back-to-front. */
function colorAt(x, y) {
  if (!inRoundedSquare(x, y, 0.18)) return [0, 0, 0, 0];
  let c = BG;
  // dewlap (behind head, hangs below the jaw)
  if (inCircle(x, y, 0.5, 0.88, 0.14)) c = DEWLAP;
  // head + snout
  if (inCircle(x, y, 0.5, 0.52, 0.30)) c = SCALE;
  if (inCircle(x, y, 0.5, 0.76, 0.17)) c = SCALE;
  // dorsal spikes along the top of the head
  if (inCircle(x, y, 0.38, 0.24, 0.05)) c = RIDGE;
  if (inCircle(x, y, 0.5, 0.19, 0.055)) c = RIDGE;
  if (inCircle(x, y, 0.62, 0.24, 0.05)) c = RIDGE;
  // brow ridge above the eye
  if (inCircle(x, y, 0.37, 0.40, 0.065)) c = RIDGE;
  // eye + nostril
  if (inCircle(x, y, 0.38, 0.47, 0.045)) c = DARK;
  if (inCircle(x, y, 0.5, 0.82, 0.02)) c = DARK;
  return [...c, 255];
}

// ---- rasterize with 4x4 supersampling ----------------------------------------

function raster(size) {
  const px = new Uint8Array(size * size * 4);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = colorAt(
            (x + (sx + 0.5) / SS) / size,
            (y + (sy + 0.5) / SS) / size,
          );
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const i = (y * size + x) * 4;
      px[i] = a ? r / a : 0;
      px[i + 1] = a ? g / a : 0;
      px[i + 2] = a ? b / a : 0;
      px[i + 3] = a / (SS * SS);
    }
  }
  return px;
}

// ---- minimal PNG writer --------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  { dir: join(root, 'site', 'icons'), sizes: [16, 48, 128, 192, 512] },
  { dir: join(root, 'extension', 'icons'), sizes: [16, 48, 128] },
];
for (const { dir, sizes } of targets) {
  mkdirSync(dir, { recursive: true });
  for (const size of sizes) {
    const file = join(dir, `icon${size}.png`);
    writeFileSync(file, png(size, raster(size)));
    console.log(`wrote ${file}`);
  }
}
