import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from 'node:fs/promises';

import { app, BrowserWindow, nativeImage } from "electron";
import type { Branding } from '../common/branding';
import { renderBrandIcon } from './studio/branding';

/**
 * Runtime icon assets are copied next to the bundled main process into
 * `dist-electron/assets/icons` (see `copyStaticAssets` in vite.config.ts), so
 * they resolve identically in `vite dev` and in a packaged build.
 *
 * The approved Phosphor recording glyph is rendered on the selected brand color.
 */
const dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_DIR = path.join(dirname, "assets", "icons");

const iconFile = (name: string): string => path.join(ICON_DIR, name);
let brandedTile: Electron.NativeImage | null = null;
const iconListeners = new Set<() => void>();

export async function prepareBrandIcon(brand: Branding): Promise<Electron.NativeImage> {
  return nativeImage.createFromBuffer(await renderBrandIcon(brand, await readFile(iconFile('record.svg'), 'utf8')));
}

export function applyBrandIcon(icon: Electron.NativeImage): void {
  brandedTile = icon;
  for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed() && process.platform !== 'darwin') win.setIcon(icon);
  if (app.dock) app.dock.setIcon(icon);
  for (const listener of iconListeners) listener();
}

export function onBrandIconChanged(listener: () => void): () => void {
  iconListeners.add(listener);
  return () => { iconListeners.delete(listener); };
}

function load(name: string): Electron.NativeImage | null {
  const image = nativeImage.createFromPath(iconFile(name));
  return image.isEmpty() ? null : image;
}

/**
 * Tray glyph for the menu bar / notification area, using the current tile.
 */
export function trayIcon(): Electron.NativeImage | null {
  if (process.platform === "darwin") {
    return brandedTile ?? load("studio-active.png");
  }
  const tile = brandedTile ?? load("studio-active.png");
  return tile ? tile.resize({ width: 32, height: 32 }) : null;
}

/** Full-resolution Workflow Studio app tile used to drive the macOS Dock icon. */
export function dockIcon(): Electron.NativeImage | null {
  if (process.platform !== "darwin") return null;
  return brandedTile ?? load("studio-active.png");
}

/**
 * Window icon for Windows/Linux (taskbar + title bar). macOS returns undefined
 * because it draws windows from the app bundle / Dock icon instead.
 */
export function windowIcon(): Electron.NativeImage | undefined {
  if (process.platform === "darwin") return undefined;
  return brandedTile ?? load("studio-active.png") ?? undefined;
}
