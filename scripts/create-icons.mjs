import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="115" fill="#3d5d49"/><text x="256" y="375" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="340" fill="#fffef7">c</text><circle cx="386" cy="363" r="20" fill="#e4b79e"/></svg>`;
await mkdir('public/icons', { recursive: true });
await writeFile('public/favicon.svg', svg);
for (const [size, name] of [[192,'icon-192'],[512,'icon-512'],[180,'apple-touch-icon'],[512,'maskable-512']]) {
  const source = name.startsWith('maskable') ? svg.replace('rx="115"', 'rx="0"') : svg;
  await sharp(Buffer.from(source)).resize(size,size).png().toFile(`public/icons/${name}.png`);
}
