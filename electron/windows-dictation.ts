import koffi from 'koffi';
import { BrowserWindow, ipcMain } from 'electron';

/** Fixed Win+H only. No caller-provided keys, commands or shell scripts. */
export function registerWindowsDictation() {
  ipcMain.handle('studio:dictate', (event, consent: unknown) => {
    try {
      if (process.platform !== 'win32') throw new Error('Windows-Diktat ist nur unter Windows verfügbar.');
      const window = BrowserWindow.fromWebContents(event.sender);
      if (consent !== true || !window?.isFocused() || !event.sender.getURL().startsWith('file:')) throw new Error('Bitte das Textfeld im Studio aktivieren und erneut versuchen.');
      const user32 = koffi.load('user32.dll');
      const foreground = user32.func('GetForegroundWindow', 'void *', []);
      const keys = user32.func('GetAsyncKeyState', 'int16', ['int32']);
      const send = user32.func('SendInput', 'uint32', ['uint32', 'void *', 'int32']);
      const handle = window.getNativeWindowHandle();
      const expected = handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE());
      const current = foreground();
      if (!current || koffi.address(current) !== expected) throw new Error('Bitte das Textfeld im Studio aktivieren und erneut versuchen.');
      if ([0x10,0x11,0x12,0x5b,0x5c,0x48].some(k => keys(k) & 0x8000)) throw new Error('Tasten loslassen und Diktieren erneut starten.');
      const size = process.arch === 'ia32' ? 28 : 40, offset = size === 40 ? 8 : 4;
      const input = Buffer.alloc(size * 4);
      [0x5b,0x48,0x48,0x5b].forEach((key,i) => {
        input.writeUInt32LE(1,i*size); input.writeUInt16LE(key,i*size+offset);
        input.writeUInt32LE(i>1?2:0,i*size+offset+4);
      });
      if (send(4,input,size) !== 4) {
        send(2,input.subarray(size*2),size);
        throw new Error('Windows-Diktat konnte nicht geöffnet werden. Im Textfeld Windows + H drücken.');
      }
      return {ok:true};
    } catch (e) { return {ok:false,error:e instanceof Error?e.message:String(e)}; }
  });
}
