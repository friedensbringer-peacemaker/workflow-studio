import { useEffect, useRef, useState } from 'react';
import { SCREEN_TO_GIF, type ScreenToGifJob, type ScreenToGifRequest, type ScreenToGifStatus } from '../common/screentogif';
import type { StudioDocument } from '../common/studio';
import type { StepMaterial } from '../common/step-material';
import { tr, useUiLanguage } from './i18n';

const api=()=>window.skillRecorder.studio;
export function ScreenToGifDialog({document,stepId,materialId,onClose,onImport}:{
 document:StudioDocument|null;stepId?:string;materialId?:string;onClose:()=>void;onImport:(stepId:string,material:StepMaterial,mainImage:boolean)=>void;
}){
 const dialog=useRef<HTMLDialogElement>(null);const language=useUiLanguage();
 const index=Math.max(0,document?.steps.findIndex(s=>s.id===stepId)??0);
 const [status,setStatus]=useState<ScreenToGifStatus|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [downloadConsent,setDownloadConsent]=useState(false);const [mode,setMode]=useState<ScreenToGifRequest['mode']>(materialId?'material':'steps');
 const [first,setFirst]=useState(index);const [last,setLast]=useState(index);const [delay,setDelay]=useState(800);const [pointer,setPointer]=useState(true);
 const [videoConsent,setVideoConsent]=useState(false);const [job,setJob]=useState<ScreenToGifJob|null>(null);const [mainImage,setMainImage]=useState(false);
 const [copied,setCopied]=useState(false);
 const [previous,setPrevious]=useState<ScreenToGifJob[]>([]);
 const target=document?.steps.find(s=>s.id===stepId);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 useEffect(()=>{if(!document||!stepId)return;let alive=true;void api().screenToGifJobs(document.sessionId,stepId).then(r=>{if(alive&&r.ok&&r.value)setPrevious(r.value);}).catch(()=>{});return()=>{alive=false;};},[document?.sessionId,stepId]);
 useEffect(()=>{let alive=true;const refresh=()=>void api().screenToGifStatus().then(r=>{if(alive&&r.ok&&r.value)setStatus(r.value);}).catch(()=>{});refresh();const timer=setInterval(refresh,1500);return()=>{alive=false;clearInterval(timer);};},[]);
 useEffect(()=>{if(!job||!document)return;let alive=true;const timer=setInterval(()=>void api().screenToGifJob(document.sessionId,job.id).then(r=>{if(alive&&r.ok&&r.value)setJob(r.value);}).catch(()=>{}),2000);return()=>{alive=false;clearInterval(timer);};},[job?.id,document?.sessionId]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[busy]);
 const run=async(action:()=>Promise<void>)=>{setError('');setBusy(true);try{await action();}catch(e){setError(tr(e instanceof Error?e.message:String(e)));}finally{setBusy(false);}};
 const launch=()=>run(async()=>{
   if(!document||!stepId)return;
   const r=await api().screenToGifOpen(document,{mode,stepId,first,last,delay,pointer,materialId,originalVideoConfirmed:videoConsent,language});
   if(!r.ok||!r.value)throw new Error(r.error);setJob(r.value);
 });
 const take=(name?:string)=>run(async()=>{
   if(!job||!document||!target)return;
   if((target.materials?.length??0)>=20)throw new Error('Höchstens 20 Dateien pro Schritt. Weniger Dateien auswählen.');
   const r=await api().screenToGifImport(document.sessionId,job.id,name);if(!r.ok)throw new Error(r.error);
   if(r.value)onImport(job.stepId,r.value,mainImage&&r.value.kind==='image');
 });
 return <dialog ref={dialog} className="studio-modal studio-stg" aria-label="ScreenToGif" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
 <div className="studio-section-head"><div><span className="studio-eyebrow">{tr('OPTIONALES WERKZEUG')}</span><h2>ScreenToGif</h2></div><button disabled={busy} onClick={onClose}>{tr('Schließen')}</button></div>
 <p>{tr('Kurze Abläufe als Animation erklären: lokal an ScreenToGif übergeben, dort bearbeiten und das Ergebnis wieder diesem Schritt hinzufügen.')}</p>
 <section className="studio-stg-setup"><strong>{tr(status?.installed?'ScreenToGif ist eingerichtet.':'ScreenToGif ist optional.')}</strong>
 {status?.path&&<p className="studio-stg-path">{status.path}</p>}
 <p>{tr('Die verwaltete portable Version enthält ihre Laufzeit. Keine Administratorrechte und kein automatischer Start nach dem Download.')}</p>
 <div className="studio-material-actions"><button disabled={busy} onClick={()=>void run(async()=>{const r=await api().screenToGifSelect();if(!r.ok||!r.value)throw new Error(r.error);setStatus(r.value);})}>{tr('Vorhandene EXE auswählen')}</button><button disabled={busy} onClick={()=>void api().screenToGifInfo('release')}>{tr('Offizielle Version und Quelle')}</button></div>
 {!status?.installed&&<><label className="studio-consent"><input type="checkbox" checked={downloadConsent} disabled={busy} onChange={e=>setDownloadConsent(e.target.checked)}/><span>{tr('ScreenToGif {version} optional herunterladen (~70 MB).',{version:SCREEN_TO_GIF.version})}<small>{tr('Offizielles GitHub-Archiv, feste Version und SHA-256-Prüfung. ScreenToGif bleibt eine separate Anwendung mit eigener Lizenz.')}</small></span></label>
 <button className="studio-primary" disabled={busy||!downloadConsent||!status?.supported} onClick={()=>void run(async()=>{const r=await api().screenToGifDownload(true);if(!r.ok||!r.value)throw new Error(r.error);setStatus(r.value);setDownloadConsent(false);})}>{tr('Herunterladen und einrichten')}</button></>}
 {(status?.downloading||busy&&!status?.installed)&&status?.downloading&&<div role="status"><progress max={status.total} value={status.downloaded}/><span>{Math.round(status.downloaded/Math.max(1,status.total)*100)}%</span><button onClick={()=>void api().screenToGifCancelDownload()}>{tr('Download abbrechen')}</button></div>}
 <details><summary>{tr('Version und Lizenz')}</summary><p>ScreenToGif {SCREEN_TO_GIF.version} · Microsoft Public License (Ms-PL)</p><small>SHA-256: {SCREEN_TO_GIF.sha256}</small><button onClick={()=>void api().screenToGifInfo('license')}>{tr('Lizenz ansehen')}</button></details></section>
 {document&&target?<section className="studio-stg-work"><h3>{target.title}</h3>
 {previous.length>0&&<details><summary>{tr('Frühere Bearbeitungen fortsetzen')}</summary><div className="studio-stg-results">{previous.map(item=><button disabled={busy} key={item.id} onClick={()=>{setJob(item);setCopied(false);}}>{new Date(item.createdAt).toLocaleString(language==='de'?'de-AT':'en-GB')} · {tr('Ergebnis übernehmen')}</button>)}</div></details>}
 {!job?<><label>{tr('An ScreenToGif übergeben')}<select value={mode} disabled={busy} onChange={e=>{setMode(e.target.value as ScreenToGifRequest['mode']);setVideoConsent(false);}}>
 <option value="steps">{tr('Bildfolge aus Schrittbildern')}</option><option value="video">{tr('Originalvideo der Sitzung')}</option>{materialId&&<option value="material">{tr('Ausgewähltes Bild oder Video')}</option>}<option value="recorder">{tr('Zusätzlichen kurzen Clip aufnehmen')}</option></select></label>
 {mode==='steps'&&<><div className="studio-stg-range"><label>{tr('Von Schritt')}<select value={first} disabled={busy} onChange={e=>{const n=Number(e.target.value);setFirst(n);setLast(Math.min(Math.max(last,n),n+59,document.steps.length-1));}}>{document.steps.map((s,i)=><option key={s.id} value={i}>{i+1}. {s.title}</option>)}</select></label><label>{tr('Bis Schritt')}<select value={last} disabled={busy} onChange={e=>setLast(Number(e.target.value))}>{document.steps.map((s,i)=>i>=first&&i-first<60?<option key={s.id} value={i}>{i+1}. {s.title}</option>:null)}</select></label></div>
 <label>{tr('Anzeigedauer pro Schritt (Millisekunden)')}<input type="number" min={100} max={5000} step={100} value={delay} disabled={busy} onChange={e=>setDelay(Number(e.target.value))}/></label><label className="studio-consent"><input type="checkbox" checked={pointer} disabled={busy} onChange={e=>setPointer(e.target.checked)}/><span>{tr('Gespeicherte Klickposition markieren.')}</span></label><p>{tr('Übernimmt bis zu 60 gewählte Schrittbilder mit bearbeiteten Bildern und fester Dauer. Für kontinuierliche Bewegung das Sitzungsvideo wählen. Originale bleiben erhalten.')}</p></>}
 {mode==='video'&&<label className="studio-consent"><input type="checkbox" checked={videoConsent} disabled={busy} onChange={e=>setVideoConsent(e.target.checked)}/><span>{tr('Originalvideo lokal an ScreenToGif übergeben. Es kann Inhalte enthalten, die im Schrittbild bereits geschwärzt wurden.')}<small>{tr('Videoimport kann in ScreenToGif einen zusätzlichen Codec oder FFmpeg benötigen.')}</small></span></label>}
 {mode==='recorder'&&<p>{tr('Öffnet den ScreenToGif-Recorder ohne Aufnahmestart. Bereich wählen und dort bewusst starten. Unser Aufnahmeschutz gilt in diesem externen Recorder nicht automatisch.')}</p>}
 <button className="studio-primary" disabled={busy||!status?.installed||(mode==='video'&&!videoConsent)} onClick={()=>void launch()}>{tr('In ScreenToGif öffnen')}</button></>:<>
 <p>{tr('In ScreenToGif als GIF, Bild oder Video exportieren. Für direkte Erkennung den folgenden Ausgabeordner verwenden. Anschließend das Ergebnis prüfen und übernehmen.')}</p><label>{tr('Ausgabeordner')}<input value={job.output} readOnly/></label>
 <div className="studio-material-actions"><button disabled={busy} onClick={()=>void navigator.clipboard.writeText(job.output).then(()=>setCopied(true)).catch(()=>setError(tr('Pfad konnte nicht kopiert werden.')))}>{tr(copied?'Pfad kopiert':'Ausgabeordner kopieren')}</button><button disabled={busy} onClick={()=>void api().screenToGifFolder(document.sessionId,job.id)}>{tr('Ausgabeordner öffnen')}</button></div>
 <label className="studio-consent"><input type="checkbox" checked={mainImage} disabled={busy} onChange={e=>setMainImage(e.target.checked)}/><span>{tr('Übernommenes Bild auch als Schrittbild verwenden.')}</span></label>
 <div className="studio-stg-results">{job.files?.map(file=><button key={file.name} disabled={busy} onClick={()=>void take(file.name)}><span>{file.name}</span><small>{Math.ceil(file.bytes/1024)} KB · {tr('Übernehmen')}</small></button>)}</div>
 <button className="studio-primary" disabled={busy} onClick={()=>void take()}>{tr('Ergebnisdatei auswählen und übernehmen')}</button><p>{tr('Ergebnisse werden als neue lokale Anhänge kopiert. Maximal 25 MB. Danach den Prozess speichern. Keine automatische KI-Übermittlung.')}</p>
 <button disabled={busy} onClick={()=>{setJob(null);setCopied(false);}}>{tr('Weitere Bearbeitung vorbereiten')}</button></>}
 </section>:<p>{tr('Zum Bearbeiten zuerst eine Aufnahme und einen Zielschritt öffnen.')}</p>}
 {busy&&<p role="status">{tr('Wird verarbeitet …')}</p>}{error&&<p role="alert" className="studio-error">{error}</p>}
 </dialog>;
}
