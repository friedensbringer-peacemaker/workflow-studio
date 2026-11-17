import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ImageEditSchema, type ImageEdit } from '../../common/image-edit';
import type { StudioStep } from '../../common/studio';
import { resolveMaterial } from './materials';
export async function readFrame(dir: string, file: string): Promise<Buffer> {
  if (!/^[a-z0-9_.-]+\.(png|jpe?g|webp)$/i.test(file)) throw new Error('Ungültiger Bildpfad.');
  const base = await realpath(dir); const frames = await realpath(path.join(base, 'frames'));
  const relative = path.relative(base, frames);
  const target = await realpath(path.join(frames, file));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.dirname(target) !== frames || (await stat(target)).size > 5_000_000) throw new Error('Ungültiger Bildpfad.');
  return readFile(target);
}
export async function stepImage(dir: string, step: StudioStep): Promise<Buffer | null> {
  if (step.image) {
    const { material, target } = await resolveMaterial(dir, step.image.id);
    if (material.kind !== 'image') throw new Error('Schrittbild muss ein Bild sein.');
    return readFile(target);
  }
  return step.frame ? readFrame(dir, step.frame) : null;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]!);
export async function renderImageEdit(input: Buffer, recipe: ImageEdit): Promise<Buffer> {
  const edit = ImageEditSchema.parse(recipe);
  const image = sharp(input, { limitInputPixels: 16_777_216 }); const meta = await image.metadata();
  if (!['png', 'jpeg', 'webp', 'gif'].includes(meta.format ?? '')) throw new Error('Nur Rasterbilder bearbeiten.');
  const normalized = await image.rotate().png().toBuffer(); const size = await sharp(normalized).metadata();
  const width = size.width!, height = size.height!;
  const marks = [...edit.marks.filter(m => m.kind !== 'mask'), ...edit.marks.filter(m => m.kind === 'mask')];
  const drawing = marks.map(m => {
    const x = Math.round(m.x * width), y = Math.round(m.y * height), x2 = Math.round(m.x2 * width), y2 = Math.round(m.y2 * height);
    const left = Math.min(x,x2), top = Math.min(y,y2), w = Math.max(1,Math.abs(x2-x)), h = Math.max(1,Math.abs(y2-y));
    if (m.kind === 'mask') return `<rect x="${left}" y="${top}" width="${w}" height="${h}" fill="#000"/>`;
    if (m.kind === 'box') return `<rect x="${left}" y="${top}" width="${w}" height="${h}" fill="none" stroke="#ffdd04" stroke-width="${Math.max(3,width/300)}"/>`;
    if (m.kind === 'arrow') return `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="#ffdd04" stroke-width="${Math.max(3,width/300)}" marker-end="url(#head)"/>`;
    return `<text x="${x}" y="${Math.min(height, y+Math.max(16,width/45))}" font-family="sans-serif" font-size="${Math.max(16,width/45)}" fill="#000" stroke="#fff" stroke-width="2" paint-order="stroke">${escape(m.text ?? '')}</text>`;
  }).join('');
  let rendered = normalized;
  if (drawing) rendered = await sharp(rendered).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><marker id="head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#ffdd04"/></marker></defs>${drawing}</svg>`) }]).png().toBuffer();
  if (edit.crop) {
    const left = Math.floor(edit.crop.x * width), top = Math.floor(edit.crop.y * height);
    rendered = await sharp(rendered).extract({ left, top, width: Math.max(1,Math.min(width-left,Math.round(edit.crop.width*width))), height: Math.max(1,Math.min(height-top,Math.round(edit.crop.height*height))) }).png().toBuffer();
  }
  return rendered;
}
