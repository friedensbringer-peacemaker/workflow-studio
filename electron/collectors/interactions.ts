import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { desktopCapturer, screen } from 'electron';
import type { Collector, CollectorContext } from '../recorder/collector';
import { safeControlChords, type InputCaptureSettings, type NativeInputSample, type PointerSample } from '../../common/input-capture';
import { createWindowsInputReader, createWindowBoundsReader } from './windows-input';
import { pointInRegion, type CaptureRegion } from '../../common/capture-region';

/** Explicit session-scoped polling; no input is read before Start or after Stop. */
export class InteractionCollector implements Collector {
  readonly name = 'interactions';
  private timer: ReturnType<typeof setInterval> | null = null;
  private previous: NativeInputSample | null = null;
  private lastPointer: PointerSample | null = null;
  private lastPointerAt = 0;
  private pending = new Set<ReturnType<typeof setTimeout>>();
  private writes = new Set<Promise<void>>();
  private active = false;
  private count = 0;

  constructor(private readonly settings: InputCaptureSettings, private readonly selectedDisplayId?: string, private readonly sourceId?: string, private readonly region?: CaptureRegion) {}

  async start(ctx: CollectorContext): Promise<void> {
    if (process.platform !== 'win32') {
      ctx.publish('input.status', { available: false, reason: 'Interaction capture currently supports Windows only.' }); return;
    }
    const read = createWindowsInputReader(this.settings.shortcuts);
    const readWindow = createWindowBoundsReader(this.sourceId);
    await mkdir(path.join(ctx.sessionDir, 'frames'), { recursive: true });
    this.active = true; this.count = 0; this.previous = null; this.lastPointer = null;
    ctx.publish('input.status', { available: true, reason: 'Mouse polling 20ms; pointer samples up to 10/s. Keyboard captures navigation/control keys only, never typed text. Native password-field detection is best effort.' });
    const tick = () => {
      if (!this.active) return;
      try {
        const sample = read(); if (!sample) return;
        const now = Date.now();
        const point = screen.screenToDipPoint({ x: sample.physicalX, y: sample.physicalY });
        const display = screen.getDisplayNearestPoint(point);
        const window = this.sourceId?.startsWith('window:') ? readWindow() : null;
        if (this.sourceId?.startsWith('window:') && !window) { this.previous = sample; return; }
        const relative = window
          ? pointInRegion((sample.physicalX - window.x) / window.width, (sample.physicalY - window.y) / window.height)
          : pointInRegion((point.x - display.bounds.x) / display.bounds.width, (point.y - display.bounds.y) / display.bounds.height, this.region);
        if (!relative || (!window && this.selectedDisplayId && String(display.id) !== this.selectedDisplayId)) { this.previous = sample; return; }
        const position: PointerSample = { ...point, physicalX: sample.physicalX, physicalY: sample.physicalY,
          displayId: String(display.id), normalizedX: (point.x - display.bounds.x) / display.bounds.width,
          normalizedY: (point.y - display.bounds.y) / display.bounds.height };
        position.normalizedX = relative.x; position.normalizedY = relative.y;
        if (this.settings.pointer && now - this.lastPointerAt >= 100 && (!this.lastPointer || this.lastPointer.x !== point.x || this.lastPointer.y !== point.y)) {
          ctx.publish('input.pointer', position); this.lastPointer = position; this.lastPointerAt = now;
        }
        if (this.previous) {
          for (const button of ['primary', 'secondary', 'middle'] as const) {
            if (this.previous.buttons[button] && !sample.buttons[button]) {
              const clickId = randomUUID();
              ctx.publish('input.click', { ...position, clickId, button, passwordField: sample.passwordField });
              if (this.settings.mode !== 'video' && sample.passwordField !== true) {
                const timeout = setTimeout(() => {
                  this.pending.delete(timeout);
                  if (!this.active) return;
                  const task = this.snapshot(ctx, clickId, position.displayId, now, read);
                  this.writes.add(task); void task.finally(() => this.writes.delete(task));
                }, this.settings.delayMs);
                this.pending.add(timeout);
              }
            }
          }
          if (this.settings.shortcuts) for (const keys of safeControlChords(sample.keys, this.previous.keys, sample.passwordField)) {
            ctx.publish('input.shortcut', { keys, passwordField: sample.passwordField === true ? 'unknown' : sample.passwordField });
          }
        }
        this.previous = sample;
      } catch (error) {
        ctx.log.warn('Interaction capture stopped after native read failure.');
        this.active = false;
        if (this.timer) clearInterval(this.timer); this.timer = null;
        ctx.publish('input.status', { available: false, reason: 'Input capture failed; other session capture may continue.' });
      }
    };
    tick(); this.timer = setInterval(tick, 20);
  }

  private async snapshot(ctx: CollectorContext, clickId: string, displayId: string, triggerEpoch: number, read: () => NativeInputSample | null): Promise<void> {
    try {
      if (!this.active) return;
      if (this.count >= 1000 || this.writes.size >= 2) {
        ctx.publish('input.status', { available: false, reason: 'Click screenshot skipped: session limit or capture queue reached. Mouse events continue.' });
        return;
      }
      const before = read();
      if (!before || before.passwordField === true) return;
      ++this.count;
      const display = screen.getAllDisplays().find(d => String(d.id) === displayId); if (!display) return;
      const ratio = Math.min(1, 1920 / (display.size.width * display.scaleFactor), 1080 / (display.size.height * display.scaleFactor));
      const sources = await desktopCapturer.getSources({ types: [this.sourceId?.startsWith('window:') ? 'window' : 'screen'], thumbnailSize: {
        width: Math.round(display.size.width * display.scaleFactor * ratio), height: Math.round(display.size.height * display.scaleFactor * ratio) } });
      const after = read();
      if (!this.active || !after || after.passwordField === true) return;
      const source = this.sourceId?.startsWith('window:') ? sources.find(s => s.id === this.sourceId) : sources.find(s => s.display_id === displayId); if (!source || source.thumbnail.isEmpty()) return;
      let thumbnail = source.thumbnail;
      if (this.region) {
        const size = thumbnail.getSize(); const x = Math.floor(this.region.x * size.width), y = Math.floor(this.region.y * size.height);
        thumbnail = thumbnail.crop({ x, y, width: Math.max(1, Math.min(size.width - x, Math.round(this.region.width * size.width))), height: Math.max(1, Math.min(size.height - y, Math.round(this.region.height * size.height))) });
      }
      const file = `click_${clickId}.jpg`; const size = thumbnail.getSize(); const capturedEpoch = Date.now();
      await writeFile(path.join(ctx.sessionDir, 'frames', file), thumbnail.toJPEG(85));
      ctx.publish('input.screenshot', { file, clickId, triggerEpoch, capturedEpoch, ...size });
    } catch { ctx.log.warn('A click screenshot could not be saved.'); }
  }

  async stop(): Promise<void> {
    this.active = false;
    if (this.timer) clearInterval(this.timer); this.timer = null;
    for (const timeout of this.pending) clearTimeout(timeout); this.pending.clear();
    await Promise.allSettled([...this.writes]);
    this.previous = null; this.lastPointer = null;
  }
}
