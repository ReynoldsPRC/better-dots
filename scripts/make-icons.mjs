// Generates the app icons as PNGs with no dependencies (node:zlib only).
// Design: four slate dots joined into a closed square loop, on the light background.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0xf5, 0xf2, 0xec];
const DOT = [0x55, 0x7f, 0xae];
const SS = 4; // supersampling per axis

function icon(size, safe) {
  // safe: fraction of the canvas the motif may use (smaller for maskable icons).
  const c = size / 2;
  const half = (size * safe) / 2;
  const r = half * 0.3;
  const off = half - r;
  const centers = [[c - off, c - off], [c + off, c - off], [c + off, c + off], [c - off, c + off]];
  const lineW = r * 0.5;
  const inside = (x, y) => {
    for (const [cx, cy] of centers) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return true;
    // Square loop edges between the dot centers.
    const onX = Math.abs(Math.abs(x - c) - off) <= lineW / 2 && Math.abs(y - c) <= off;
    const onY = Math.abs(Math.abs(y - c) - off) <= lineW / 2 && Math.abs(x - c) <= off;
    return onX || onY;
  };
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++)
          if (inside(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hits++;
      const a = hits / (SS * SS);
      for (let ch = 0; ch < 3; ch++)
        raw[y * (size * 3 + 1) + 1 + x * 3 + ch] = Math.round(BG[ch] * (1 - a) + DOT[ch] * a);
    }
  }
  return png(size, raw);
}

function png(size, raw) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', icon(192, 0.62));
writeFileSync('public/icons/icon-512.png', icon(512, 0.62));
writeFileSync('public/icons/icon-maskable-512.png', icon(512, 0.48));
writeFileSync('public/icons/apple-touch-icon.png', icon(180, 0.62));
console.log('icons written');
