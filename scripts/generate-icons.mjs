// Генерирует PNG-иконки PWA без внешних зависимостей (только zlib из Node.js).
// Рисунок: синий фон, белое кольцо и горизонтальная полоса («пояс»).
// Запуск: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT_DIR = new URL('../public/icons/', import.meta.url);
const BG = [0x1f, 0x4f, 0xd1];
const FG = [0xff, 0xff, 0xff];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
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

// Доля пикселя, покрытая фигурой, через суперсэмплинг 4x4.
function coverage(x, y, size) {
  let hits = 0;
  for (let sy = 0; sy < 4; sy++) {
    for (let sx = 0; sx < 4; sx++) {
      const px = (x + (sx + 0.5) / 4) / size - 0.5;
      const py = (y + (sy + 0.5) / 4) / size - 0.5;
      const r = Math.hypot(px, py);
      const ring = r > 0.24 && r < 0.31;
      const belt = Math.abs(py) < 0.035 && Math.abs(px) < 0.24;
      if (ring || belt) hits++;
    }
  }
  return hits / 16;
}

function png(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const a = coverage(x, y, size);
      for (let i = 0; i < 3; i++) row[1 + x * 3 + i] = Math.round(BG[i] * (1 - a) + FG[i] * a);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // глубина цвета
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#1f4fd1"/>
  <circle cx="50" cy="50" r="27.5" fill="none" stroke="#fff" stroke-width="7"/>
  <rect x="26" y="46.5" width="48" height="7" fill="#fff"/>
</svg>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(new URL('icon-192.png', OUT_DIR), png(192));
writeFileSync(new URL('icon-512.png', OUT_DIR), png(512));
writeFileSync(new URL('apple-touch-icon.png', OUT_DIR), png(180));
writeFileSync(new URL('icon.svg', OUT_DIR), svg);
console.log('Иконки созданы в public/icons/');
