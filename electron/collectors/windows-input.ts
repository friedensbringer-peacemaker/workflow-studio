import koffi from 'koffi';
import { SAMPLED_KEYS, type NativeInputSample } from '../../common/input-capture';

export function createWindowBoundsReader(sourceId?: string) {
  const match = sourceId?.match(/^window:(\d+):/);
  if (!match) return () => null;
  const user32 = koffi.load('user32.dll');
  const rect = user32.func('GetWindowRect', 'int32', ['void *', 'void *']);
  const iconic = user32.func('IsIconic', 'int32', ['void *']);
  const handle = koffi.as(BigInt(match[1]), 'void *'); const bytes = Buffer.alloc(16);
  return () => {
    if (iconic(handle) || !rect(handle, bytes)) return null;
    const x = bytes.readInt32LE(0), y = bytes.readInt32LE(4);
    const width = bytes.readInt32LE(8) - x, height = bytes.readInt32LE(12) - y;
    return width > 0 && height > 0 ? { x, y, width, height } : null;
  };
}

/** Read state only; no hooks, text extraction, key translation or input injection. */
export function createWindowsInputReader(keyboard: boolean): () => NativeInputSample | null {
  const user32 = koffi.load('user32.dll');
  const cursor = user32.func('GetCursorPos', 'int32', ['void *']);
  const keyState = user32.func('GetAsyncKeyState', 'int16', ['int32']);
  const metrics = user32.func('GetSystemMetrics', 'int32', ['int32']);
  const guiInfo = user32.func('GetGUIThreadInfo', 'int32', ['uint32', 'void *']);
  const className = user32.func('GetClassNameW', 'int32', ['void *', 'void *', 'int32']);
  const style = process.arch === 'ia32'
    ? user32.func('GetWindowLongW', 'int32', ['void *', 'int32'])
    : user32.func('GetWindowLongPtrW', 'int64', ['void *', 'int32']);
  const point = Buffer.alloc(8); const info = Buffer.alloc(process.arch === 'ia32' ? 48 : 72);
  const name = Buffer.alloc(256);
  const down = (vk: number) => (keyState(vk) & 0x8000) !== 0;
  return () => {
    if (!cursor(point)) return null;
    let passwordField: NativeInputSample['passwordField'] = 'unknown';
    info.fill(0); info.writeUInt32LE(info.length);
    if (guiInfo(0, info)) {
      const handle = process.arch === 'ia32' ? BigInt(info.readUInt32LE(12)) : info.readBigUInt64LE(16);
      if (handle !== 0n) {
        const focused = koffi.as(handle, 'void *');
        const length = className(focused, name, 128);
        if (/^(Edit|RichEdit)/i.test(name.toString('utf16le', 0, length * 2))) passwordField = (BigInt(style(focused, -16)) & 0x20n) !== 0n;
      }
    }
    const swapped = Boolean(metrics(23));
    return { physicalX: point.readInt32LE(0), physicalY: point.readInt32LE(4),
      buttons: { primary: down(swapped ? 2 : 1), secondary: down(swapped ? 1 : 2), middle: down(4) },
      keys: keyboard ? SAMPLED_KEYS.filter(down) : [], passwordField };
  };
}
