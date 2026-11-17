export const STUDIO_WINDOW_MODES = ['integrated', 'docked', 'minimal'] as const;
export type StudioWindowMode = typeof STUDIO_WINDOW_MODES[number];
export function isStudioWindowMode(value: unknown): value is StudioWindowMode {
  return typeof value === 'string' && (STUDIO_WINDOW_MODES as readonly string[]).includes(value);
}
export type WindowBounds = { x: number; y: number; width: number; height: number };

/** Fit the combined workspace on its monitor, including monitors left of the primary. */
export function integratedWorkspaceBounds(recorder: WindowBounds, area: WindowBounds): WindowBounds {
  const margin = 12;
  const width = Math.max(1, Math.min(1540, area.width - margin * 2));
  const height = Math.max(1, Math.min(820, area.height - margin * 2));
  return {
    x: Math.round(Math.max(area.x + margin, Math.min(recorder.x, area.x + area.width - margin - width))),
    y: Math.round(Math.max(area.y + margin, Math.min(recorder.y, area.y + area.height - margin - height))),
    width: Math.round(width), height: Math.round(height),
  };
}
