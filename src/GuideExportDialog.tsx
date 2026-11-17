import { useEffect, useRef, useState } from 'react';
import type { StudioDocument } from '../common/studio';
import { tr } from './i18n';
import { StudioIcon as Icon } from './StudioIcon';

export function GuideExportDialog({ document, onClose, onDone, onActivity }: {
  document: StudioDocument; onClose: () => void; onDone: (file: string) => void; onActivity: (busy: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [materials, setMaterials] = useState(true); const [transcript, setTranscript] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const images = document.steps.filter(s => s.frame).length;
  const files = new Set(document.steps.flatMap(s => s.materials?.map(m => m.id) ?? [])).size;
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  const run = async (format: 'zip' | 'markdown' | 'json' | 'svg' | 'drawio' | 'mermaid') => {
    setBusy(true); setError(''); onActivity(true);
    try {
      const result = format === 'zip' ? await window.skillRecorder.studio.exportGuide(document, { materials, transcript })
        : await window.skillRecorder.studio.export({ ...document, transcript: transcript ? document.transcript : '', steps: document.steps.map(step => ({ ...step, materials: materials ? step.materials : [] })) }, format);
      if (!result.ok) throw new Error(result.error);
      if (result.value) onDone(result.value);
    } catch (e) { setError(tr(e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); onActivity(false); }
  };
  return <dialog ref={dialog} className="studio-modal studio-guide-export" aria-labelledby="guide-export-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="studio-section-head"><span className="studio-eyebrow">{tr('OFFLINE WEITERGEBEN')}</span><button disabled={busy} onClick={onClose} aria-label={tr('Schließen')}><Icon name="close"/></button></div>
    <h2 id="guide-export-title">{tr('Anleitung exportieren')}</h2>
    <p>{tr('ZIP vollständig entpacken und index.html öffnen. Die Anleitung funktioniert ohne Installation und ohne Internet.')}</p>
    <div className="studio-export-summary"><strong>{document.title || tr('Unbenannter Prozess')}</strong><span>{tr('Schritte: {steps} · Bildschirmbilder: {images}', { steps: document.steps.length, images })}</span></div>
    <label className="studio-consent"><input type="checkbox" checked={materials} disabled={busy || !files} onChange={e => setMaterials(e.target.checked)}/><span>{tr('Zusatzdateien einschließen: {count}', { count: files })}<small>{tr('Zugeordnete Bilder, Dokumente und Sprachnotizen werden als Kopien beigefügt.')}</small></span></label>
    <label className="studio-consent"><input type="checkbox" checked={transcript} disabled={busy || !document.transcript} onChange={e => setTranscript(e.target.checked)}/><span>{tr('Originaltranskript einschließen')}<small>{tr('Zusätzliche Notizen und bereits eingefügte Sprachnotiz-Texte gehören unabhängig davon zu den Schritten.')}</small></span></label>
    <p className="studio-export-disclosure">{tr('Bilder und Anhänge vor Weitergabe prüfen. Der Export schwärzt keine Inhalte automatisch. Rohvideo, Ereignisprotokoll und Anmeldedateien werden nicht beigefügt.')}</p>
    <p className="studio-material-note">{tr('Exportiert den aktuellen Bearbeitungsstand. Die lokale Sitzung wird dadurch nicht gespeichert.')}</p>
    {error && <div className="studio-error" role="alert">{error}</div>}
    {busy && <p role="status">{tr('Export wird erstellt …')}</p>}
    <div className="studio-modal-actions"><button disabled={busy} onClick={onClose}>{tr('Abbrechen')}</button><button className="studio-primary" disabled={busy} onClick={() => void run('zip')}><Icon name="download"/>{tr('ZIP speichern')}</button></div>
    <details className="studio-export-formats"><summary>{tr('Weitere Formate: Markdown, Diagramm und Daten')}</summary><p>{tr('Diese Formate enthalten keine eingebetteten Dateien.')}</p><div className="studio-material-actions"><button disabled={busy} onClick={() => void run('markdown')}>{tr('Markdown exportieren')}</button><button disabled={busy} onClick={() => void run('json')}>{tr('JSON exportieren')}</button><button disabled={busy} onClick={() => void run('svg')}>{tr('Flussdiagramm (SVG)')}</button><button disabled={busy} onClick={() => void run('drawio')}>{tr('Bearbeitbar für draw.io')}</button><button disabled={busy} onClick={() => void run('mermaid')}>{tr('Mermaid exportieren')}</button></div></details>
  </dialog>;
}
