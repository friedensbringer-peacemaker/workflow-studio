import { useEffect, useRef, type ReactNode } from 'react';
import { StudioIcon } from './StudioIcon';

/** A native disclosure with normal tab navigation, light dismissal and Escape. */
export function ActionMenu({ label, children, disabled = false }: { label: string; children: ReactNode; disabled?: boolean }) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) root.current?.removeAttribute('open');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && root.current?.open) {
        event.preventDefault(); root.current.open = false; root.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  useEffect(() => { if (disabled && root.current) root.current.open = false; }, [disabled]);
  return <details className="action-menu" ref={root}>
    <summary aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }}>{label}<StudioIcon name="next"/></summary>
    <div className="action-menu-items" onClick={event => {
      const button = (event.target as HTMLElement).closest('button');
      if (button && !button.disabled && root.current) { root.current.open = false; root.current.querySelector('summary')?.focus(); }
    }}>{children}</div>
  </details>;
}
