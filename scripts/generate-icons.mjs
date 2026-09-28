// Genera los PNG de la PWA a partir de los SVG de public/icons (npm run icons).
import sharp from "sharp";

const out = [
  ["public/icons/icon.svg", "public/icons/icon-192.png", 192],
  ["public/icons/icon.svg", "public/icons/icon-512.png", 512],
  ["public/icons/icon-maskable.svg", "public/icons/icon-maskable-512.png", 512],
  ["public/icons/icon-maskable.svg", "public/icons/apple-touch-icon.png", 180],
  ["public/icons/icon.svg", "public/favicon.png", 48],
];
for (const [src, dest, size] of out) {
  await sharp(src, { density: 600 }).resize(size, size).png().toFile(dest);
  console.log("✓", dest);
}
