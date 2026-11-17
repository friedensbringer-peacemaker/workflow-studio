import { app } from 'electron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_INPUT_CAPTURE, InputCaptureSettingsSchema, type InputCaptureSettings } from '../common/input-capture';

export const inputSettingsFile = () => path.join(app.getPath('userData'), 'input-capture-settings.json');
export function readInputSettings(): InputCaptureSettings {
  try { return InputCaptureSettingsSchema.parse(JSON.parse(readFileSync(inputSettingsFile(), 'utf8'))); }
  catch { return { ...DEFAULT_INPUT_CAPTURE }; }
}
