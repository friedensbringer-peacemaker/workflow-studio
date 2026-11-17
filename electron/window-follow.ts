type Position = { x: number; y: number };
interface FollowWindow {
  getBounds(): Position;
  setPosition(x: number, y: number, animate?: boolean): void;
  isDestroyed(): boolean;
  isMaximized(): boolean;
  isMinimized(): boolean;
  on(event: string, listener: () => void): unknown;
  removeListener(event: string, listener: () => void): unknown;
}

/** Translate both windows as a pair, without resizing or feeding move events back. */
export function followWindow(anchor: FollowWindow, companion: FollowWindow) {
  const windows = [anchor, companion];
  const previous = windows.map(window => window.getBounds());
  let disposed = false;
  let repositioning = false;
  const reset = () => { windows.forEach((window, index) => { if (!window.isDestroyed()) previous[index] = window.getBounds(); }); };
  const move = (index: number) => {
    if (disposed || repositioning || anchor.isDestroyed() || companion.isDestroyed()) return;
    const source = windows[index]; const targetIndex = 1 - index; const target = windows[targetIndex];
    const next = source.getBounds();
    const dx = next.x - previous[index].x; const dy = next.y - previous[index].y;
    previous[index] = next;
    if ((!dx && !dy) || source.isMaximized() || source.isMinimized() || target.isMaximized() || target.isMinimized()) return;
    const current = target.getBounds();
    const destination = { x: Math.round(current.x + dx), y: Math.round(current.y + dy) };
    // Update before setPosition: Electron may emit move synchronously or later.
    previous[targetIndex] = destination;
    target.setPosition(destination.x, destination.y, false);
    if (!target.isDestroyed()) previous[targetIndex] = target.getBounds();
  };
  const moveAnchor = () => move(0); const moveCompanion = () => move(1);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    anchor.removeListener('move', moveAnchor); anchor.removeListener('moved', moveAnchor);
    companion.removeListener('move', moveCompanion); companion.removeListener('moved', moveCompanion);
    anchor.removeListener('closed', dispose); companion.removeListener('closed', dispose);
  };
  anchor.on('move', moveAnchor); anchor.on('moved', moveAnchor);
  companion.on('move', moveCompanion); companion.on('moved', moveCompanion);
  anchor.on('closed', dispose); companion.on('closed', dispose);
  const reposition = (action: () => void) => {
    repositioning = true;
    try { action(); } finally { reset(); repositioning = false; }
  };
  return { reset, dispose, reposition };
}
