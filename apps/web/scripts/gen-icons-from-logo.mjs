// Generates PWA/notification icons from the real O'Boyle logo.
// Run with: node scripts/gen-icons-from-logo.mjs
//
// The source file is a 1536x1024 export with a large blurred vignette
// background around the mark — not usable directly as a small icon. This
// crops to the visible mark + wordmark and composites it onto a solid
// deep-black square (matching the app's icon style) at each required size.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const source = join(publicDir, "branding", "logo-original.png");
const outDir = join(publicDir, "icons");
mkdirSync(outDir, { recursive: true });

// Crop box measured against the known 1536x1024 source canvas.
const crop = { left: 440, top: 220, width: 650, height: 420 };
// Monogram only (no wordmark) — the wordmark stops being legible well
// before 32px, so the favicon uses just the mark.
const monogramCrop = { left: 675, top: 240, width: 200, height: 205 };

async function makeIcon(size, filename, { rounded = true, region = crop } = {}) {
  const cropped = await sharp(source).extract(region).png().toBuffer();

  // Fit the cropped mark into ~80% of the canvas, preserving aspect ratio.
  const maxContent = Math.round(size * 0.8);
  const scale = Math.min(maxContent / region.width, maxContent / region.height);
  const contentW = Math.round(region.width * scale);
  const contentH = Math.round(region.height * scale);

  const resizedMark = await sharp(cropped).resize(contentW, contentH).png().toBuffer();

  const r = rounded ? Math.round(size * 0.08) : 0;
  const bg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${r}" fill="#080A09"/>
</svg>`;

  await sharp(Buffer.from(bg))
    .composite([{ input: resizedMark, left: Math.round((size - contentW) / 2), top: Math.round((size - contentH) / 2) }])
    .png()
    .toFile(join(outDir, filename));

  console.log(`wrote ${filename}`);
}

await makeIcon(192, "icon-192.png");
await makeIcon(512, "icon-512.png");
await makeIcon(180, "icon-apple-180.png", { rounded: false }); // iOS applies its own mask
await makeIcon(32, "favicon-32.png", { region: monogramCrop });
await makeIcon(16, "favicon-16.png", { region: monogramCrop });

// Optimized, capped-width web version of the full lockup (mark + wordmark)
// for use in-app (login page, report headers) — cropped, not distorted.
await sharp(source)
  .extract(crop)
  .resize({ width: 800 })
  .png({ quality: 90 })
  .toFile(join(publicDir, "branding", "logo-web.png"));
console.log("wrote logo-web.png");
