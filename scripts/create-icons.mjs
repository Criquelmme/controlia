import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="115" fill="#3d5d49"/><path d="M159 110h49v136c20-37 49-51 78-51 46 0 68 28 68 77v105h-49V275c0-31-10-45-30-45-35 0-67 40-67 86v61h-49Z" fill="#fffef7"/><circle cx="386" cy="363" r="20" fill="#e4b79e"/></svg>`;
await mkdir('public/icons', { recursive: true });
await writeFile('public/favicon.svg', svg);
for (const [size, name] of [[192,'icon-192'],[512,'icon-512'],[180,'apple-touch-icon'],[512,'maskable-512']]) {
  const source = name.startsWith('maskable') ? svg.replace('rx="115"', 'rx="0"') : svg;
  await sharp(Buffer.from(source)).resize(size,size).png().toFile(`public/icons/${name}.png`);
}
