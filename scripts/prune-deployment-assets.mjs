import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';

const sourceAssets = new URL('../public/assets/', import.meta.url);
const distAssets = new URL('../dist/assets/', import.meta.url);
const artwork = [
  'advert-axiom', 'advert-else', 'advert-everon', 'advert-grinpop',
  'advert-irisyn', 'advert-kinkeep', 'advert-kuro-optics', 'advert-nesto',
  'advert-noodle', 'advert-orbital', 'advert-portrait', 'advert-quietus',
  'advert-recast', 'advert-syntask', 'advert-synthsilk', 'advert-vesper-arc',
  'advert-vyra', 'concept',
];
const sourceOnly = ['relay.glb', 'advert-prompts.json', 'user-advert-prompts.json'];

for (const name of artwork) {
  const original = new URL(`${name}.png`, sourceAssets);
  const optimized = new URL(`${name}.webp`, distAssets);
  if (!existsSync(original)) throw new Error(`Expected editable PNG source is missing: ${original.pathname}`);
  if (!existsSync(optimized)) throw new Error(`Required runtime WebP is missing from dist: ${optimized.pathname}`);
  await rm(new URL(`${name}.png`, distAssets), { force: true });
}

for (const filename of sourceOnly) await rm(new URL(filename, distAssets), { force: true });

console.log(`Prepared dist: retained ${artwork.length} optimized runtime images and excluded ${artwork.length + sourceOnly.length} source-only assets.`);
