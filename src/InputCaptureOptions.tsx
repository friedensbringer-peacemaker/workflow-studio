import { useEffect, useState } from 'react';
import { DEFAULT_INPUT_CAPTURE, type InputCaptureSettings } from '../common/input-capture';
import { tr } from './i18n';

export function InputCaptureOptions({ disabled }: { disabled: boolean }) {
  const [settings, setSettings] = useState<InputCaptureSettings>(DEFAULT_INPUT_CAPTURE);
  const [busy, setBusy] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const off = window.skillRecorder.studio.onInputSettingsChanged?.(setSettings) ?? (() => {});
    void window.skillRecorder.studio.inputSettings().then(result => {
      if (!active) return;
      if (result.ok && result.value) setSettings(result.value); else setError(tr('Aufnahmeeinstellungen konnten nicht geladen werden.'));
    }).catch(() => { if (active) setError(tr('App vollständig beenden und neu starten.')); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; off(); };
  }, []);
  const update = async (patch: Partial<InputCaptureSettings>) => {
    setBusy(true); setError('');
    try { const result = await window.skillRecorder.studio.saveInputSettings({ ...settings, ...patch });
      if (!result.ok || !result.value) throw new Error(result.error); setSettings(result.value);
    } catch { setError(tr('Aufnahmeeinstellungen konnten nicht gespeichert werden.')); } finally { setBusy(false); }
  };
  return <details className="input-capture-options"><summary>{tr('Aufnahmeart')}: {tr(settings.mode === 'steps' ? 'Klick-Screenshots' : settings.mode === 'video' ? 'Video' : 'Video + Klick-Screenshots')}</summary>
    <fieldset disabled={disabled || busy}>
      <label>{tr('Aufnahmeart')}<select aria-label={tr('Aufnahmeart')} value={settings.mode} onChange={e => void update({ mode: e.target.value as InputCaptureSettings['mode'] })}>
        <option value="steps">{tr('Klick-Screenshots')}</option><option value="video">{tr('Video')}</option><option value="both">{tr('Video + Klick-Screenshots')}</option>
      </select></label>
      <label><input type="checkbox" checked={settings.pointer} onChange={e => void update({ pointer: e.target.checked })}/>{tr('Mausposition protokollieren')}</label>
      <small>{tr('Bis zu zehn Positionsmessungen pro Sekunde bei Bewegung. Klicks enthalten immer Position und Zeitstempel.')}</small>
      <label>{tr('Verzögerung nach Klick (ms)')}<input type="number" min={0} max={2000} step={50} value={settings.delayMs} onChange={e => {
        const value = Number(e.target.value); if (Number.isInteger(value) && value >= 0 && value <= 2000) void update({ delayMs: value });
      }}/></label>
      <label><input type="checkbox" checked={settings.shortcuts} onChange={e => void update({ shortcuts: e.target.checked })}/>{tr('Steuertasten und Kombinationen erfassen')}</label>
      <small>{tr('Nur Tab, Enter, Escape, Pfeile, Bild- und Navigationstasten mit optionalen Modifikatoren. Keine eingegebenen Zeichen oder Textinhalte.')}</small>
      <label><input type="checkbox" checked={settings.clipboard} onChange={e => void update({ clipboard: e.target.checked })}/>{tr('Zwischenablage-Vorschau erfassen')}</label>
      <p>{tr('Passwortfelder werden nicht in allen Apps erkannt. Sichtbare Passwörter, Zwischenablage und gesprochene Geheimnisse können trotzdem in die Aufnahme gelangen. Vor vertraulichen Eingaben Aufnahme beenden.')}</p>
    </fieldset>{error && <p role="alert">{error}</p>}
  </details>;
}
