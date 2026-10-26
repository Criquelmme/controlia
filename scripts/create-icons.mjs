import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
await mkdir('public/icons', { recursive: true });
async function createIcon(size, name, padding) {
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#f6f5f1"/></svg>`);
  const innerSize = Math.round(size * (1 - padding * 2));
  const mark = await sharp('public/brand/controlia-mark.png').resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const offset = Math.round(padding * size);
  await sharp(background).composite([{ input: mark, left: offset, top: offset }]).png().toFile(name);
}
await createIcon(32, 'public/favicon.png', 0.1);
await createIcon(192, 'public/icons/icon-192.png', 0.12);
await createIcon(512, 'public/icons/icon-512.png', 0.12);
await createIcon(180, 'public/icons/apple-touch-icon.png', 0.12);
await createIcon(512, 'public/icons/maskable-512.png', 0.23);
