import { z } from 'zod';

/** Reviewed official release; updates require a new deliberate source/digest review. */
export const SCREEN_TO_GIF = {
  version: '2.43.2', sourceCommit: 'a4d0a67c2131cd048ceec86cd40afc2f1a06f2fd',
  project: 'https://github.com/NickeManarin/ScreenToGif',
  release: 'https://github.com/NickeManarin/ScreenToGif/releases/tag/2.43.2',
  url: 'https://github.com/NickeManarin/ScreenToGif/releases/download/2.43.2/ScreenToGif.2.43.2.Portable.x64.zip',
  bytes: 73035883, sha256: '42a0b53d67ecae22698b4881ffb2c9c7a9049663f5fbdd2edb779e1971000664',
  exeBytes: 182977192, exeSha256: '92b1cc86c9e8eec3bfb4b5208d9082b820d8624851123da942c7b34b6ec6f9da',
} as const;

export interface ScreenToGifStatus {
  supported: boolean; installed: boolean; path: string; managed: boolean;
  version: string; downloading: boolean; downloaded: number; total: number;
}
export const ScreenToGifRequestSchema = z.object({
  mode: z.enum(['steps', 'video', 'material', 'recorder']),
  stepId: z.string().min(1).max(128),
  first: z.number().int().min(0).max(999).default(0),
  last: z.number().int().min(0).max(999).default(0),
  delay: z.number().int().min(100).max(5000).default(800),
  pointer: z.boolean().default(true), materialId: z.string().uuid().optional(),
  originalVideoConfirmed: z.boolean().default(false), language: z.enum(['de', 'en']),
}).refine(v => v.mode !== 'steps' || (v.last >= v.first && v.last-v.first < 60), 'Select 1–60 steps.');
export type ScreenToGifRequest = z.infer<typeof ScreenToGifRequestSchema>;
export const ScreenToGifJobSchema = z.object({
  id: z.string().uuid(), stepId: z.string().min(1).max(128), createdAt: z.number(),
  mode: z.enum(['steps', 'video', 'material', 'recorder']),
});
export type ScreenToGifJob = z.infer<typeof ScreenToGifJobSchema> & { output: string; input?: string; files?: { name: string; bytes: number }[] };
export function screenToGifArgs(language: 'de'|'en', mode: ScreenToGifRequest['mode'], input?: string): string[] {
  // Never pass -capture: opening the recorder must not start a recording.
  return ['-new', '-lang', language, '-open', mode === 'recorder' ? 'screen' : 'editor',
    ...(mode === 'recorder' ? ['-frequency','10fps','-limit','00:00:20'] : input ? [input] : [])];
}
