import { z } from 'zod';
import { CaptureRegionSchema } from './capture-region';
const unit = z.number().min(0).max(1);
export const ImageMarkSchema = z.object({ kind: z.enum(['mask', 'box', 'arrow', 'text']), x: unit, y: unit, x2: unit, y2: unit, text: z.string().max(160).optional() });
export const ImageEditSchema = z.object({ crop: CaptureRegionSchema.optional(), marks: z.array(ImageMarkSchema).max(100) });
export type ImageEdit = z.infer<typeof ImageEditSchema>;
export type ImageMark = z.infer<typeof ImageMarkSchema>;
export type ImageEditResult = { image: import('./step-material').StepMaterial; pointer?: { x: number; y: number } };
