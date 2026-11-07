// Generates favicon, PWA icons and social preview images from SVG templates.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "icons");
fs.mkdirSync(OUT, { recursive: true });

const tile = (x, y, fill, letter, rotate) => `
  <g transform="translate(${x} ${y}) rotate(${rotate})">
    <rect x="0" y="0" width="72" height="72" rx="12" fill="${fill}" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>
    <text x="36" y="53" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="#ffffff">${letter}</text>
  </g>`;

const svgLogo = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b2f7a"/>
      <stop offset="1" stop-color="#1e1b3c"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  ${tile(118, 220, "#16a34a", "L", -8)}
  ${tile(310, 220, "#dc2626", "K", 8)}
  <rect x="322" y="168" width="10" height="224" rx="5" fill="#f0b429"/>
</svg>`;

const svgFav = `
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="7" fill="#2b2458"/>
  <rect x="4" y="15" width="10" height="10" rx="2.5" fill="#16a34a"/>
  <rect x="18" y="15" width="10" height="10" rx="2.5" fill="#dc2626"/>
  <text x="9" y="24" text-anchor="middle" font-family="Arial" font-size="8" font-weight="800" fill="#fff">L</text>
  <text x="23" y="24" text-anchor="middle" font-family="Arial" font-size="8" font-weight="800" fill="#fff">K</text>
</svg>`;

const svgOg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b2f7a"/>
      <stop offset="1" stop-color="#1e1b3c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(110 250) rotate(-8)"><rect width="160" height="160" rx="24" fill="#16a34a"/><text x="80" y="116" text-anchor="middle" font-family="Arial" font-size="104" font-weight="800" fill="#fff">L</text></g>
  <g transform="translate(930 250) rotate(8)"><rect width="160" height="160" rx="24" fill="#dc2626"/><text x="80" y="116" text-anchor="middle" font-family="Arial" font-size="104" font-weight="800" fill="#fff">K</text></g>
  <text x="600" y="150" text-anchor="middle" font-family="Arial" font-size="72" font-weight="800" fill="#ffffff">Lingo &amp; Karogs</text>
  <text x="600" y="215" text-anchor="middle" font-family="Arial" font-size="34" fill="#cfc9f2">Divas leģendāras spēles. Jauns sākums.</text>
</svg>`;

await sharp(Buffer.from(svgLogo))
  .resize(512, 512)
  .png()
  .toFile(path.join(OUT, "icon-512.png"));
await sharp(Buffer.from(svgLogo))
  .resize(192, 192)
  .png()
  .toFile(path.join(OUT, "icon-192.png"));
await sharp(Buffer.from(svgLogo))
  .resize(180, 180)
  .png()
  .toFile(path.join(ROOT, "public", "apple-touch-icon.png"));
await sharp(Buffer.from(svgFav)).png().toFile(path.join(ROOT, "public", "favicon.png"));
await sharp(Buffer.from(svgOg))
  .png()
  .toFile(path.join(ROOT, "public", "og-image.png"));

console.log("icons generated");
