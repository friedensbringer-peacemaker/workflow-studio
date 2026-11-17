import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Render the approved Phosphor Light glyph on a neutral green tile.
// Preserve its MIT license in src/assets/icons/phosphor/LICENSE and public/licenses.
const source = new URL('../src/assets/icons/phosphor/record.svg', import.meta.url);
const target = new URL('../electron/assets/icons/studio-active.png', import.meta.url);
const original = await readFile(source, 'utf8');
const svg = original.replace('fill="currentColor"', 'fill="#1E2520"')
  .replace(/(<svg[^>]*>)/, '$1<rect width="256" height="256" rx="48" fill="#D8F4B5"/>');
await writeFile(target, await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer());

await writeFile(new URL('../build/icon.png', import.meta.url), await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer());
