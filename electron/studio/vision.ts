import sharp from 'sharp';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { StudioDocument } from '../../common/studio';
import type { SensitiveModelManager } from '../sensitive/model-manager';
import { OcrFrameRedactor } from '../sensitive/frame-redact';
import { stepImage } from './images';
import type { VisionInput } from './providers';

/** Never falls back to raw pixels when the selected protection cannot run. */
export async function prepareVision(dir: string, document: StudioDocument, values: string[], models?: SensitiveModelManager): Promise<VisionInput[]> {
  if (!models) throw new Error('Bildschutz ist nicht verfügbar.');
  const protectedMode = models.isAdvancedEnabled();
  if (protectedMode && !models.isAdvancedReady()) throw new Error('Bildschutz noch nicht bereit. OCR zuerst einrichten oder Bildübermittlung abwählen.');
  const redactor = new OcrFrameRedactor({ ocr: models.getOcr(), knownValues: values });
  const temporary = await mkdtemp(path.join(tmpdir(), 'studio-image-protection-'));
  const files: string[] = []; const images: VisionInput[] = [];
  try {
    for (const step of document.steps.filter(s => s.image || s.frame).slice(0, 4)) {
      let bytes = await stepImage(dir, step); if (!bytes) continue;
      if (protectedMode) {
        const file = path.join(temporary, `${files.length}.png`); files.push(file);
        await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
        const protectedBytes = await redactor.redactFrame(file);
        if (!protectedBytes) throw new Error('Bildschutz fehlgeschlagen. Keine Bilder wurden übertragen.');
        bytes = protectedBytes;
      }
      const jpeg = await sharp(bytes, { limitInputPixels: 16_777_216 }).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
      if (jpeg.length > 1_500_000) throw new Error('Bild ist für die Analyse zu groß.');
      images.push({ stepId: step.id, mime: 'image/jpeg', data: jpeg.toString('base64') });
    }
    if (!images.length) throw new Error('Keine Schrittbilder für die Analyse vorhanden.');
    return images;
  } finally { for (const file of files) await unlink(file).catch(() => {}); await rmdir(temporary).catch(() => {}); }
}
