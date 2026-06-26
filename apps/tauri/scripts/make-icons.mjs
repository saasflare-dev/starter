// Generates placeholder RGBA PNG icons for Tauri (a solid rounded square).
// These are stand-ins so the app builds and shows *something* in the tray and
// Dock. Replace with real branding before release:
//   pnpm tauri icon path/to/your-1024.png   # generates the full platform set
//
// `tray.png` (colored) and `tray-template.png` (black, recolored by macOS for
// the light/dark menu bar) are tray-only and not produced by `tauri icon`, so
// we keep generating them here.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ACCENT = [59, 130, 246, 255]; // #3b82f6
const BLACK = [0, 0, 0, 255]; // macOS template glyph (alpha is what matters)

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
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, color) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const radius = size / 5;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte 0 + pixels
    for (let x = 0; x < size; x++) {
      // rounded-corner mask
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      const inside = dx * dx + dy * dy <= radius * radius;
      const [r, g, b, a] = inside ? color : [0, 0, 0, 0];
      row.set([r, g, b, a], 1 + x * 4);
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src-tauri/icons',
);
mkdirSync(outDir, { recursive: true });

// App / Dock icons (colored).
for (const [name, size] of [
  ['icon.png', 512],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['32x32.png', 32],
]) {
  writeFileSync(join(outDir, name), png(size, ACCENT));
  console.log('wrote', name);
}

// Tray icons: colored for Windows/Linux, black template for the macOS menu bar.
writeFileSync(join(outDir, 'tray.png'), png(32, ACCENT));
console.log('wrote tray.png');
writeFileSync(join(outDir, 'tray-template.png'), png(32, BLACK));
console.log('wrote tray-template.png');
