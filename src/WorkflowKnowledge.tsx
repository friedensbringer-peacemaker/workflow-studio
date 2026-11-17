import { useEffect, useRef, useState } from 'react';
import { StudioDocumentSchema, type ProviderProfile, type StudioDocument } from '../common/studio';
import { applyInterview, interviewQuestions, skillMarkdown, type InterviewQuestion } from '../common/workflow-knowledge';
import { StepSupplements } from './StepSupplements';
import { tr, useUiLanguage } from './i18n';

export function WorkflowKnowledge({document,profile,kind,onClose,onApply,onExport}: {
 document:StudioDocument;profile:ProviderProfile;kind:'interview'|'skill';onClose:()=>void;onApply:(document:StudioDocument)=>void;onExport:(file:string)=>void;
}) {
 const language=useUiLanguage();
 const dialog=useRef<HTMLDialogElement>(null);
 const [questions,setQuestions]=useState<InterviewQuestion[]>(()=>document.interview?.length?structuredClone(document.interview):interviewQuestions(document,language));
 const [selected,setSelected]=useState(0);
 const [skillLanguage,setSkillLanguage]=useState<'auto'|'de'|'en'>('auto');
 const outputLanguage=skillLanguage==='auto'?language:skillLanguage;
 const [body,setBody]=useState(()=>skillMarkdown(document,language));
 const [edited,setEdited]=useState(false);
 const previousLanguage=useRef(outputLanguage);
 useEffect(()=>{if(previousLanguage.current===outputLanguage)return;previousLanguage.current=outputLanguage;if(!edited){setBody(skillMarkdown(document,outputLanguage));setReviewed(false);setConsent(false);}},[outputLanguage,edited,document]);
 const [consent,setConsent]=useState(false);const [reviewed,setReviewed]=useState(false);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const q=questions[selected];
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[busy]);
 const update=(patch:Partial<InterviewQuestion>)=>setQuestions(values=>values.map((v,i)=>i===selected?{...v,...patch}:v));
 const generate=async()=>{setBusy(true);setError('');try{
   const r=await window.skillRecorder.studio.knowledge(document,profile.id,kind,consent,outputLanguage);if(!r.ok||!r.value)throw new Error(r.error);
   if(r.value.questions){setQuestions(values=>[...values,...r.value!.questions!].slice(0,100));}
   if(r.value.skill){setBody(r.value.skill);setReviewed(false);setEdited(true);}
 }catch(e){setError(tr(e instanceof Error?e.message:String(e)));}finally{setBusy(false);setConsent(false);}};
 return <dialog ref={dialog} className="studio-modal studio-knowledge" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-label={tr(kind==='interview'?'Wissensinterview':'Skill erstellen')}>
 <div className="studio-section-head"><h2>{tr(kind==='interview'?'Wissensinterview':'Skill erstellen')}</h2><button disabled={busy} onClick={onClose}>{tr('Schließen')}</button></div>
 {kind==='interview'?<>
 <p>{tr('Kläre Gründe, Voraussetzungen und Ausnahmen. Nur ausdrücklich geprüfte Antworten werden in den Prozess übernommen. Entwürfe bleiben im Interview erhalten.')}</p>
 {questions.length>0?<><label>{tr('Frage')}<select disabled={busy} value={selected} onChange={e=>setSelected(Number(e.target.value))}>{questions.map((v,i)=><option key={v.id} value={i}>{i+1}. {v.question}</option>)}</select></label>
 <div className="studio-interview-question"><span className="studio-eyebrow">{q.stepId?document.steps.find(s=>s.id===q.stepId)?.title:document.title}</span><h3>{q.question}</h3></div>
 <StepSupplements allowImagePromotion={false} supplementLimit={6000} key={q.id} sessionId={document.sessionId} step={{id:q.id,title:q.question,detail:'',why:'',exceptions:'',app:'',source:'manual',supplement:q.answer,materials:q.materials}} disabled={busy} onActivity={setBusy} onChange={patch=>update({...('supplement'in patch?{answer:patch.supplement??'',reviewed:false}:{}),...('materials'in patch?{materials:patch.materials}: {})})}/>
 <label className="studio-consent"><input type="checkbox" checked={q.reviewed} disabled={busy||!q.answer.trim()} onChange={e=>update({reviewed:e.target.checked})}/><span>{tr('Diese Antwort ist fachlich geprüft.')}</span></label>
 <div className="studio-modal-actions"><button disabled={busy||selected===0} onClick={()=>setSelected(selected-1)}>{tr('Zurück')}</button><button disabled={busy||selected===questions.length-1} onClick={()=>setSelected(selected+1)}>{tr('Nächste Frage')}</button></div></>:<p>{tr('Keine offenen Fragen gefunden. Ergänze bei Bedarf eigene Informationen direkt am Schritt.')}</p>}
 <button className="studio-primary" disabled={busy} onClick={()=>{try{onApply(StudioDocumentSchema.parse(applyInterview(document,questions)));}catch{setError(tr('Antworten sind zu lang oder nicht mehr zuordenbar. Bitte kürzen und erneut prüfen.'));}}}>{tr('Interview übernehmen')}</button>
 </>:<><p>{tr('Erstellt eine eigenständige SKILL.md aus dem bearbeiteten Prozess. Prüfe Regeln und offene Fragen vor dem Export. Keine automatische Installation oder Ausführung.')}</p><label>{tr('Sprache des Skills')}<select aria-label={tr('Sprache des Skills')} disabled={busy} value={skillLanguage} onChange={e=>{const next=e.target.value as 'auto'|'de'|'en';if(edited&&!window.confirm(tr('Bearbeiteten Skill durch eine neue Vorlage ersetzen?')))return;setEdited(false);setSkillLanguage(next);setBody(skillMarkdown(document,next==='auto'?language:next));setReviewed(false);setConsent(false);}}><option value="auto">{tr('Wie Programmeinstellung')} · {language==='de'?'Deutsch':'English'}</option><option value="de">Deutsch</option><option value="en">English</option></select></label><p className="studio-material-note">{tr('Die Sprache gilt für die Skill-Vorlage und neue KI-Vorschläge. Eigene Prozessinhalte werden lokal unverändert übernommen. Eine vollständige Übersetzung ist über „Skill mit KI überarbeiten“ möglich.')}</p><label>SKILL.md<textarea className="studio-skill-source" rows={16} maxLength={60000} disabled={busy} value={body} onChange={e=>{setBody(e.target.value);setReviewed(false);setEdited(true);}}/></label>
 <label className="studio-consent"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/><span>{tr('Inhalt, Berechtigungen und offene Fragen geprüft.')}</span></label>
 <button className="studio-primary" disabled={busy||!reviewed} onClick={async()=>{setBusy(true);setError('');try{const r=await window.skillRecorder.studio.exportSkill(document,body,reviewed);if(!r.ok)throw new Error(r.error);if(r.value)onExport(r.value);}catch(e){setError(tr(e instanceof Error?e.message:String(e)));}finally{setBusy(false);}}}>{tr('SKILL.md exportieren')}</button></>}
 <details className="studio-knowledge-ai"><summary>{tr('Optional mit KI ergänzen')}</summary><p>{tr('Übermittelt bearbeitete Schritttexte und Transkript an den gewählten Anbieter. Bilder und Zusatzdateien bleiben lokal. Antworten werden nicht automatisch bestätigt.')}</p>
 <label className="studio-consent"><input type="checkbox" checked={consent} disabled={busy||profile.kind==='copilot'} onChange={e=>setConsent(e.target.checked)}/><span>{tr('Text an {provider} senden.',{provider:profile.name})}</span></label>
 <div className="studio-ai-actions"><button disabled={busy||!consent} onClick={()=>void generate()}>{tr(kind==='interview'?'Weitere Fragen vorschlagen':'Skill mit KI überarbeiten')}</button>{busy&&<button onClick={()=>void window.skillRecorder.studio.cancel()}>{tr('KI-Anfrage abbrechen')}</button>}</div></details>
 {busy&&<p role="status">{tr('Wird verarbeitet …')}</p>}{error&&<p className="studio-error" role="alert">{error}</p>}
 </dialog>;
}
