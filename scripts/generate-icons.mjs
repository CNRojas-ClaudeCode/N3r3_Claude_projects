// Genera los iconos PWA (PNG) sin dependencias externas.
// Uso: node scripts/generate-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'client', 'public', 'icons');

// Tokens del sistema de diseño
const PRIMARY = [0x2f, 0x6b, 0xff];
const SURFACE = [0xff, 0xff, 0xff];
const SUPERSAMPLE = 4;

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const encodePng = (size, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const inRoundedRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

// Glifo: bolsa de compras (cabe en la zona segura del 80% para iconos maskable)
const inGlyph = (x, y) => {
  const body = inRoundedRect(x, y, 0.3, 0.4, 0.7, 0.74, 0.045);
  const d = Math.hypot(x - 0.5, y - 0.4);
  const handle = y <= 0.4 && d <= 0.125 && d >= 0.085;
  return body || handle;
};

/** variant: 'any' (esquinas redondeadas transparentes) | 'full' (cuadrado opaco: maskable/apple) */
const render = (size, variant) => {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          const insideBg = variant === 'full' || inRoundedRect(x, y, 0, 0, 1, 1, 0.22);
          if (insideBg) {
            bg++;
            if (inGlyph(x, y)) fg++;
          }
        }
      }
      const i = (py * size + px) * 4;
      const t = bg ? fg / bg : 0;
      for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(PRIMARY[c] * (1 - t) + SURFACE[c] * t);
      rgba[i + 3] = Math.round((bg / samples) * 255);
    }
  }
  return encodePng(size, rgba);
};

const icons = [
  ['icon-192.png', 192, 'any'],
  ['icon-512.png', 512, 'any'],
  ['icon-512-maskable.png', 512, 'full'],
  ['apple-touch-icon-180.png', 180, 'full'],
  ['favicon-32.png', 32, 'any'],
];

fs.mkdirSync(outDir, { recursive: true });
for (const [name, size, variant] of icons) {
  fs.writeFileSync(path.join(outDir, name), render(size, variant));
  console.log(`icons/${name} (${size}x${size}, ${variant})`);
}
