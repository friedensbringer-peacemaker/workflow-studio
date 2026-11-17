import { useEffect, useState } from 'react';
import type { StudioWindowMode } from '../common/window-layout';
import { Recorder } from './Recorder';
import { Studio } from './Studio';
import { Library } from './Library';
import { WindowModeControl } from './WindowModeControl';
import { tr, useUiLanguage } from './i18n';

/** Studio never unmounts during layout changes, preserving unsaved edits and dialogs. */
export function StudioWorkspace({ legacy = false }: { legacy?: boolean }) {
  useUiLanguage();
  const [mode, setMode] = useState<StudioWindowMode>('docked');
  useEffect(() => {
    let active = true;
    const off = window.skillRecorder.studio.onWindowModeChanged(setMode);
    void window.skillRecorder.studio.windowMode().then(result => { if (active && result.ok && result.value) setMode(result.value); }).catch(() => {});
    return () => { active = false; off(); };
  }, []);
  return <div className={`studio-workspace studio-workspace-${mode}`}>
    <aside className="workspace-recorder" hidden={mode !== 'integrated'}>{mode === 'integrated' && <Recorder embedded/>}</aside>
    <section className="workspace-studio">{legacy ? <><div className="legacy-workspace-header"><button onClick={() => { window.location.replace('#library'); window.location.reload(); }}>{tr('Zum Studio')}</button><WindowModeControl disabled={false}/></div><Library/></> : <Studio/>}</section>
  </div>;
}
