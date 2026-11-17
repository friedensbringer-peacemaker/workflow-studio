import { z } from 'zod';

export const InputCaptureSettingsSchema = z.object({
  mode: z.enum(['video', 'steps', 'both']).default('both'),
  pointer: z.boolean().default(true),
  shortcuts: z.boolean().default(false),
  clipboard: z.boolean().default(false),
  delayMs: z.number().int().min(0).max(2000).default(350),
});
export type InputCaptureSettings = z.infer<typeof InputCaptureSettingsSchema>;
export const DEFAULT_INPUT_CAPTURE = InputCaptureSettingsSchema.parse({});

export type PointerSample = {
  x: number; y: number; physicalX: number; physicalY: number;
  displayId: string; normalizedX: number; normalizedY: number;
};
export interface NativeInputSample {
  physicalX: number; physicalY: number;
  buttons: { primary: boolean; secondary: boolean; middle: boolean };
  keys: number[];
  passwordField: boolean | 'unknown';
}

// Never sample or store ordinary letters, numbers, punctuation or text values.
export const CONTROL_KEYS = new Map<number, string>([
  [9, 'Tab'], [13, 'Enter'], [27, 'Escape'], [33, 'PageUp'], [34, 'PageDown'],
  [35, 'End'], [36, 'Home'], [37, 'ArrowLeft'], [38, 'ArrowUp'], [39, 'ArrowRight'], [40, 'ArrowDown'],
]);
export const MODIFIER_KEYS = new Map<number, string>([[16, 'Shift'], [17, 'Ctrl'], [18, 'Alt'], [91, 'Meta'], [92, 'Meta']]);
export const SAMPLED_KEYS = [...CONTROL_KEYS.keys(), ...MODIFIER_KEYS.keys()];
export function safeControlChords(current: readonly number[], previous: readonly number[], passwordField: NativeInputSample['passwordField']): string[][] {
  if (passwordField === true) return [];
  const down = new Set(current); const old = new Set(previous);
  // AltGr is Ctrl+Alt on Windows; do not treat its text input as a shortcut.
  if (down.has(17) && down.has(18)) return [];
  const modifiers = [...new Set([...MODIFIER_KEYS].filter(([vk]) => down.has(vk)).map(([, label]) => label))];
  return [...CONTROL_KEYS].filter(([vk]) => down.has(vk) && !old.has(vk)).map(([, label]) => [...modifiers, label]);
}
