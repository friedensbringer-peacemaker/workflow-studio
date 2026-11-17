import sharp from 'sharp';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BrandingSchema, DEFAULT_BRANDING, foreground, type Branding } from '../../common/branding';

/** Keep the approved glyph, but render its tile in the selected accent color. */
export async function renderBrandIcon(input: Branding, glyphSvg: string): Promise<Buffer> {
  const brand = BrandingSchema.parse(input);
  const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="54" fill="${brand.primary}"/></svg>`);
  const overlay = brand.logo
    ? await sharp(Buffer.from(brand.logo.split(',')[1], 'base64'), { limitInputPixels: 16_000_000 })
      .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    : Buffer.from(glyphSvg.replaceAll('currentColor', foreground(brand.primary)));
  return sharp(tile).composite([{ input: overlay, left: brand.logo ? 32 : 0, top: brand.logo ? 32 : 0 }]).png().toBuffer();
}

export async function normalizeLogo(bytes: Uint8Array): Promise<string> {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 2_000_000) throw new Error('Logo: PNG, JPEG oder WebP bis 2 MB auswählen.');
  const image = sharp(Buffer.from(bytes), { limitInputPixels: 16_000_000 });
  const metadata = await image.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Logo: PNG, JPEG oder WebP bis 2 MB auswählen.');
  const png = await image.rotate().resize({ width: 640, height: 320, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return 'data:image/png;base64,' + png.toString('base64');
}
export async function readBranding(folder: string): Promise<Branding> {
  try { return BrandingSchema.parse(JSON.parse(await readFile(path.join(folder, 'branding.json'), 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULT_BRANDING }; throw new Error('Gestaltung konnte nicht geladen werden.'); }
}
export async function writeBranding(folder: string, input: unknown): Promise<Branding> {
  const brand = BrandingSchema.parse(input);
  if (brand.logo) brand.logo = await normalizeLogo(Buffer.from(brand.logo.split(',')[1], 'base64'));
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, 'branding.json'); const temporary = file + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(brand, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, file);
  return brand;
}
