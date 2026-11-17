import { useEffect, useState } from 'react';
import { isStudioWindowMode, type StudioWindowMode } from '../common/window-layout';
import { tr, useUiLanguage } from './i18n';

export function WindowModeControl({ disabled }: { disabled: boolean }) {
  useUiLanguage();
  const [mode, setMode] = useState<StudioWindowMode>('docked');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const off = window.skillRecorder.studio.onWindowModeChanged(setMode);
    void window.skillRecorder.studio.windowMode().then(result => { if (active && result.ok && result.value) setMode(result.value); }).catch(() => {});
    return () => { active = false; off(); };
  }, []);
  return <div className="studio-window-mode"><label>{tr('Fensteransicht')}
    <select aria-label={tr('Fensteransicht')} value={mode} disabled={disabled || busy} onChange={async event => {
      const next = event.target.value; if (!isStudioWindowMode(next)) return;
      setBusy(true); setError('');
      try { const result = await window.skillRecorder.studio.setWindowMode(next); if (!result.ok || !result.value) throw new Error(result.error); setMode(result.value); }
      catch (error) { setError(tr(error instanceof Error ? error.message : 'Fensteransicht konnte nicht geändert werden.')); }
      finally { setBusy(false); }
    }}><option value="integrated">{tr('1 Fenster · alles')}</option><option value="docked">{tr('2 Fenster · Recorder und Studio')}</option><option value="minimal">{tr('1 Fenster · nur Aufnahmen')}</option></select>
  </label>{error && <span role="alert">{error}</span>}</div>;
}
