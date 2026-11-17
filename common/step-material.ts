import { z } from 'zod';

export const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;
export const MaterialSchema = z.object({
  id: z.string().uuid(), file: z.string().regex(/^[a-f0-9-]{36}\.[a-z0-9]+$/),
  name: z.string().min(1).max(200), kind: z.enum(['image', 'audio', 'video', 'document']),
  mime: z.string().max(100), size: z.number().int().positive().max(MAX_MATERIAL_BYTES),
  createdAt: z.number(),
});
export type StepMaterial = z.infer<typeof MaterialSchema>;

const types: Record<string, [StepMaterial['kind'], string]> = {
  png: ['image', 'image/png'], jpg: ['image', 'image/jpeg'], jpeg: ['image', 'image/jpeg'],
  webp: ['image', 'image/webp'], gif: ['image', 'image/gif'],
  mp4: ['video', 'video/mp4'],
  webm: ['audio', 'audio/webm'], wav: ['audio', 'audio/wav'], mp3: ['audio', 'audio/mpeg'],
  ogg: ['audio', 'audio/ogg'], m4a: ['audio', 'audio/mp4'],
  pdf: ['document', 'application/pdf'], txt: ['document', 'text/plain'], md: ['document', 'text/markdown'],
  csv: ['document', 'text/csv'], docx: ['document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  pptx: ['document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
};
export const MATERIAL_EXTENSIONS = Object.keys(types);
export function materialType(name: string, video=false) {
  const ext = name.split('.').at(-1)?.toLowerCase() ?? '';
  const type = ext==='webm'&&video ? ['video','video/webm'] as const : types[ext];
  if (!type) throw new Error('Dieses Dateiformat wird nicht als Zusatzmaterial unterstützt.');
  return { ext, kind: type[0], mime: type[1] };
}
