import { useEffect, useRef, useState } from 'react';
import type { StudioDocument, StudioSettings } from '../common/studio';
import { REVIEW_METHODS, REVIEW_SECTIONS, reviewSnapshot, type ReviewMethod, type SavedReview } from '../common/process-review';
import { tr } from './i18n';

export function ProcessReview({ document, settings, onClose, onChange, onActivity }: { document:StudioDocument; settings:StudioSettings; onClose:()=>void; onChange:(change:Partial<StudioDocument>)=>void; onActivity:(busy:boolean)=>void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [method,setMethod] = useState<ReviewMethod>(document.reviewMethod ?? {id:'general',script:REVIEW_METHODS.general.script});
  const [provider,setProvider] = useState(settings.selected);
  const [consent,setConsent] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [result,setResult] = useState<SavedReview|undefined>(document.processReview);
  const snapshot = reviewSnapshot(document);
  useEffect(()=>{dialog.current?.showModal();},[]);
  const profile = settings.profiles.find(p=>p.id===provider);
  const run = async () => {
    setBusy(true);onActivity(true);setError('');
    try {
      const response = await window.skillRecorder.studio.reviewProcess(document,provider,method,consent);
      if(!response.ok || !response.value) throw new Error(response.error);
      setResult(response.value);
    } catch(e) {setError(tr(e instanceof Error?e.message:String(e)));}
    finally{setBusy(false);onActivity(false);}
  };
  return <dialog ref={dialog} className="studio-modal process-review" aria-label={tr('Prozess bewerten')} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <div className="studio-section-head"><h2>{tr('Prozess bewerten')}</h2><button disabled={busy} onClick={onClose}>{tr('Schließen')}</button></div>
    <p>{tr('Verständlichkeit, Verbesserung, KI-Einsatz und Voraussetzungen als gesonderten Vorschlag prüfen.')}</p>
    <label>{tr('Prüfmethodik')}<select aria-label={tr("Prüfmethodik")} value={method.id} disabled={busy} onChange={e=>{const id=e.target.value as ReviewMethod['id'];setMethod({id,script:REVIEW_METHODS[id].script});setConsent(false);}}>{Object.entries(REVIEW_METHODS).map(([id,m])=><option key={id} value={id}>{tr(m.name)}</option>)}</select></label>
    <label>{tr('Prüfdrehbuch')}<textarea aria-label={tr("Prüfdrehbuch")} rows={4} maxLength={6000} value={method.script} disabled={busy} onChange={e=>{setMethod({...method,script:e.target.value});setConsent(false);}}/></label>
    <button disabled={busy||!method.script.trim()} onClick={()=>onChange({reviewMethod:method})}>{tr('Drehbuch für diesen Prozess übernehmen')}</button>
    <label>{tr('KI-Anbieter')}<select value={provider} disabled={busy} onChange={e=>{setProvider(e.target.value);setConsent(false);}}>{settings.profiles.map(p=><option key={p.id} value={p.id} disabled={p.kind==='copilot'}>{p.name}{p.kind==='copilot'?' · '+tr('separater Analyseweg'):''}</option>)}</select></label>
    <p>{profile?.model || tr('Modell zuerst in den Einstellungen einrichten.')}</p>
    <details><summary>{tr('Verwendete Prozessdaten ansehen')}</summary><pre className="review-input">{JSON.stringify({title:document.title,intent:document.intent,steps:document.steps.map(s=>({title:s.title,detail:s.detail,why:s.why,exceptions:s.exceptions,supplement:s.supplement,narration:s.narration}))},null,2)}</pre></details>
    <label className="studio-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>{tr('Prozesstext und Prüfdrehbuch an den gewählten Anbieter senden. Bilder, Anhänge und Rohtranskript bleiben ausgenommen.')}</span></label>
    <div className="studio-material-actions"><button className="studio-secondary" disabled={busy||!consent||!method.script.trim()||profile?.kind==='copilot'} onClick={()=>void run()}>{tr('Bewertung erstellen')}</button>{busy&&<button onClick={()=>void window.skillRecorder.studio.cancel()}>{tr('Abbrechen')}</button>}</div>
    {error&&<p role="alert">{error}</p>}{busy&&<p role="status">{tr('Prozess wird bewertet …')}</p>}
    {result&&<section className="review-report"><p><strong>{tr('KI-Vorschlag – fachlich prüfen')}</strong><br/>{result.provider} · {REVIEW_METHODS[result.method.id].name} · {new Date(result.createdAt).toLocaleString()}</p>{result.snapshot!==snapshot&&<p role="status">{tr('Der Prozess wurde seit dieser Bewertung geändert. Neu bewerten.')}</p>}{REVIEW_SECTIONS.map(([key,title])=><section key={key}><h3>{tr(title)}</h3><p>{result.report[key]}</p></section>)}<h3>{tr('Offene Fragen')}</h3><ul>{result.report.questions.map((q,i)=><li key={i}>{q}</li>)}</ul><button disabled={busy||result.snapshot!==snapshot} onClick={()=>{onChange({processReview:result,reviewMethod:result.method});onClose();}}>{tr('Bericht zum Prozess übernehmen')}</button></section>}
  </dialog>;
}
