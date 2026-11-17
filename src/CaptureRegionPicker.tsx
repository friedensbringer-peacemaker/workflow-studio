import { useEffect, useRef, useState } from 'react';
import { CaptureRegionSchema, type CaptureRegion } from '../common/capture-region';
import { tr, useUiLanguage } from './i18n';

export function CaptureRegionPicker() {
  useUiLanguage();
  const source = new URLSearchParams(window.location.search).get('source') ?? '';
  const [image, setImage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [aspect, setAspect] = useState(16 / 9);
  const [region, setRegion] = useState<CaptureRegion>({ x: .1, y: .1, width: .8, height: .8 });
  const anchor = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let active = true;
    void window.skillRecorder.studio.targetPreview(source).then(result => {
      if (!active) return;
      if (result.ok && result.value) setImage(result.value); else setError(result.error ?? tr('Keine Bildschirmvorschau verfügbar.'));
    }).catch(() => { if (active) setError(tr('Keine Bildschirmvorschau verfügbar.')); });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') window.close(); };
    window.addEventListener('keydown', key);
    return () => { active = false; window.removeEventListener('keydown', key); };
  }, [source]);
  const point = (e: React.PointerEvent<HTMLElement>) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height)) };
  };
  return <main className="capture-region-picker">
    <header><div><h1>{tr('Aufnahmebereich auswählen')}</h1><p>{tr('Ziehe einen Rahmen auf der Vorschau. Nur dieser Ausschnitt wird als Bild oder Video gespeichert.')}</p></div><button onClick={() => window.close()}>{tr('Abbrechen')}</button></header>
    {error && <p role="alert">{tr(error)}</p>}
    {image ? <div className="capture-region-image" style={{ width: `min(100%, calc((100vh - 300px) * ${aspect}))` }} onPointerDown={e => { if (e.button !== 0 || busy) return; anchor.current = point(e); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => {
      if (!anchor.current) return; const p = point(e); const a = anchor.current;
      setRegion({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), width: Math.abs(p.x - a.x), height: Math.abs(p.y - a.y) });
    }} onPointerUp={e => { anchor.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} onPointerCancel={() => { anchor.current = null; }}>
      <img src={image} onLoad={e => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} alt={tr('Bildschirmvorschau')} draggable={false}/><span className="capture-region-box" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}/>
    </div> : <p role="status">{tr('Vorschau wird geladen …')}</p>}
    <fieldset disabled={busy}><legend>{tr('Ausschnitt in Prozent')}</legend>{(['x', 'y', 'width', 'height'] as const).map((key, index) => <label key={key}>{tr(['Links', 'Oben', 'Breite', 'Höhe'][index])}<input type="number" min={0} max={100} step={1} value={Math.round(region[key] * 100)} onChange={e => setRegion({ ...region, [key]: Number(e.target.value) / 100 })}/></label>)}</fieldset>
    <footer><p>{tr('Die Vorschau wird nicht gespeichert. App-Aktivitäten und optionale Sprache sind separate Erfassungswege.')}</p><button disabled={busy || !image || !CaptureRegionSchema.safeParse(region).success} onClick={async () => {
      setBusy(true); setError('');
      try { const result = await window.skillRecorder.studio.setCaptureRegion(source, region); if (!result.ok) throw new Error(result.error); window.close(); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
    }}>{tr('Bereich übernehmen')}</button></footer>
  </main>;
}
