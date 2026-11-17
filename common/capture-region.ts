import { z } from 'zod';
export const CaptureRegionSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(.01).max(1), height: z.number().min(.01).max(1) }).refine(r => r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001);
export type CaptureRegion = z.infer<typeof CaptureRegionSchema>;
export function pointInRegion(x: number, y: number, region?: CaptureRegion | null) {
  const r = region ?? { x: 0, y: 0, width: 1, height: 1 };
  const point = { x: (x - r.x) / r.width, y: (y - r.y) / r.height };
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 ? point : null;
}
