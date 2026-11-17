import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { translateUi, type UiLanguage } from '../common/ui-language';

let language: UiLanguage = 'de';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const apply = (next: UiLanguage) => {
  language = next; document.documentElement.lang = next;
  for (const listener of listeners) listener();
};
export const tr = (source: string, values?: Record<string, string | number>) => translateUi(source, language, values);
export const useUiLanguage = () => useSyncExternalStore(subscribe, () => language);

export function LanguageSync({ children }: { children: ReactNode }) {
  useEffect(() => {
    let active = true;
    let changed = false;
    const off = window.skillRecorder.studio.onLanguageChanged(next => { changed = true; apply(next); });
    void window.skillRecorder.studio.uiLanguage().then(result => { if (active && !changed && result.ok && result.value) apply(result.value); }).catch(() => {});
    return () => { active = false; off(); };
  }, []);
  return children;
}

export function LanguageSwitch() {
  const current = useUiLanguage();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const change = async (next: UiLanguage) => {
    setBusy(true); setError('');
    try { const result = await window.skillRecorder.studio.setUiLanguage(next); if (!result.ok || !result.value) throw new Error(result.error); apply(result.value); }
    catch (error) {
      const detail = error instanceof Error ? error.message : '';
      setError(tr(/No handler registered|setUiLanguage is not a function/i.test(detail)
        ? 'Bitte alle Recorder- und Studio-Fenster beenden und die App neu starten.'
        : 'Sprache konnte nicht gespeichert werden.'));
    } finally { setBusy(false); }
  };
  return <div className="ui-language"><div role="group" aria-label={tr('Sprache der Oberfläche')}>
    {(['de', 'en'] as const).map(locale => <button key={locale} type="button" aria-pressed={current === locale} aria-label={locale === 'de' ? 'Deutsch' : 'English'} disabled={busy} onClick={() => void change(locale)}>{locale.toUpperCase()}</button>)}
  </div>{error && <span role="alert">{error}</span>}</div>;
}
