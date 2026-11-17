import { useEffect,useRef,useState } from 'react';
import type { StudioDocument } from '../common/studio';
import { DEFAULT_WIKI_TARGETS,wikiMarkdown,type WikiTarget } from '../common/wiki';
import { tr } from './i18n';

export function WikiPublish({document,onClose,onActivity}:{document:StudioDocument;onClose:()=>void;onActivity:(busy:boolean)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [targets,setTargets]=useState(DEFAULT_WIKI_TARGETS),[kind,setKind]=useState<WikiTarget['kind']>('markdown');
  const [key,setKey]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
  const [includeReview,setIncludeReview]=useState(false),[confirmed,setConfirmed]=useState(false),[attempted,setAttempted]=useState(false);
  const target=targets.find(t=>t.kind===kind)!;const markdown=wikiMarkdown(document,includeReview);
  useEffect(()=>{dialog.current?.showModal();void window.skillRecorder.studio.wikiTargets().then(r=>{if(r.ok&&r.value)setTargets(r.value);else setError(r.error||tr('Wiki-Einstellungen konnten nicht geladen werden.'));});},[]);
  const change=(patch:Partial<WikiTarget>)=>{setTargets(old=>old.map(t=>t.kind===kind?{...t,...patch}:t));setConfirmed(false);};
  return <dialog ref={dialog} className="studio-modal wiki-publish" aria-label={tr('Im Wiki ablegen')} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <div className="studio-section-head"><h2>{tr('Im Wiki ablegen')}</h2><button disabled={busy} onClick={onClose}>{tr('Schließen')}</button></div>
    <p>{tr('Neue Seite aus dem aktuellen Prozesstext erstellen. Bilder, Anhänge und Rohtranskript werden nicht übertragen.')}</p>
    <label>{tr('Ziel')}<select value={kind} disabled={busy||attempted} onChange={e=>{setKind(e.target.value as WikiTarget['kind']);setKey('');setConfirmed(false);}}><option value="markdown">Markdown-Wiki</option><option value="outline">Outline</option><option value="notion">Notion</option></select></label>
    {kind==='markdown'?<><p>{target.folder||tr('Noch kein Wiki-Ordner gewählt.')}</p><button disabled={busy||attempted} onClick={async()=>{const r=await window.skillRecorder.studio.wikiFolder();if(r.ok&&r.value)change({folder:r.value});}}>{tr('Wiki-Ordner wählen')}</button></>:<>
      {kind==='outline'&&<label>{tr('Outline-Server')}<input placeholder="https://wiki.example.com" value={target.baseUrl} disabled={busy||attempted} onChange={e=>change({baseUrl:e.target.value,hasKey:false})}/></label>}
      <label>{tr(kind==='outline'?'Sammlungs-ID':'Übergeordnete Notion-Seiten-ID')}<input value={target.parentId} disabled={busy||attempted} onChange={e=>change({parentId:e.target.value})}/></label>
      <label>{tr('API-Schlüssel')}<input type="password" autoComplete="off" value={key} disabled={busy||attempted} placeholder={tr(target.hasKey?'Geschützt gespeichert; leer lassen zum Beibehalten':'Schlüssel eingeben')} onChange={e=>{setKey(e.target.value);setConfirmed(false);}}/></label>
      <p>{tr('Die Integration benötigt Schreibzugriff auf das gewählte Ziel.')}</p>
    </>}
    <button disabled={busy||attempted} onClick={async()=>{setBusy(true);setError('');try{const r=await window.skillRecorder.studio.saveWikiTarget(target,key);if(!r.ok||!r.value)throw new Error(r.error);setTargets(old=>old.map(t=>t.kind===kind?r.value!:t));setKey('');}catch(e){setError(String(e instanceof Error?e.message:e));}finally{setBusy(false);}}}>{tr('Verbindung lokal speichern')}</button>
    <label className="studio-consent"><input type="checkbox" disabled={busy||attempted||!document.processReview} checked={includeReview} onChange={e=>{setIncludeReview(e.target.checked);setConfirmed(false);}}/>{tr('KI-Bewertung als Vorschlag einschließen')}</label>
    <details open><summary>{tr('Inhaltsvorschau')}</summary><pre className="review-input">{markdown}</pre></details>
    <label className="studio-consent"><input type="checkbox" checked={confirmed} disabled={busy||attempted} onChange={e=>setConfirmed(e.target.checked)}/>{tr('Ziel und Inhalt geprüft. Neue Seite jetzt erstellen.')}</label>
    {error&&<p role="alert">{error}</p>}{result&&<p role="status">{tr('Gespeichert')}: {result}</p>}
    <button className="studio-primary" disabled={busy||attempted||!confirmed} onClick={async()=>{
      setBusy(true);onActivity(true);setError('');setAttempted(true);
      try{const saved=await window.skillRecorder.studio.saveWikiTarget(target,key);if(!saved.ok)throw new Error(saved.error);setKey('');const r=await window.skillRecorder.studio.publishWiki(document,kind,includeReview,true);if(!r.ok||!r.value)throw new Error(r.error);setResult(r.value);}catch(e){setError(String(e instanceof Error?e.message:e));}finally{setBusy(false);onActivity(false);}
    }}>{tr(busy?'Wird geschrieben …':'Neue Wiki-Seite erstellen')}</button>
  </dialog>;
}
