import { useEffect, useRef, useState } from 'react';
import { tr } from './i18n';

export function DeleteDialog({title,description,onConfirm,onClose}: {
  title:string; description:string; onConfirm:(password:string)=>Promise<void>; onClose:()=>void;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [enabled,setEnabled]=useState<boolean|null>(null),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{dialog.current?.showModal();let alive=true;void window.skillRecorder.studio.deletionStatus().then(r=>{if(!alive)return;if(r.ok&&r.value)setEnabled(r.value.enabled);else setError(tr(r.error??'Löschschutz konnte nicht geladen werden.'));}).catch(()=>{if(alive)setError(tr('Löschschutz konnte nicht geladen werden.'));});return()=>{alive=false;};},[]);
  const confirm=async()=>{setBusy(true);setError('');try{await onConfirm(password);setPassword('');onClose();}catch(e){setPassword('');setError(tr(e instanceof Error?e.message:String(e)));}finally{setBusy(false);}};
  return <dialog ref={dialog} className="studio-modal delete-dialog" aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <h2>{title}</h2><p>{description}</p>
    {enabled&&<label>{tr('Löschkennwort')}<input type="password" autoComplete="current-password" aria-label={tr('Löschkennwort')} maxLength={256} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&password&&!busy)void confirm();}}/></label>}
    {error&&<p className="studio-error" role="alert">{error}</p>}
    <div className="studio-modal-actions"><button autoFocus disabled={busy} onClick={onClose}>{tr('Abbrechen')}</button><button className="delete-confirm" disabled={busy||enabled===null||(enabled&&!password)} onClick={()=>void confirm()}>{tr('Bestätigen')}</button></div>
  </dialog>;
}

export function DeletionSettings({onBusy}: {onBusy:(busy:boolean)=>void}) {
  const [enabled,setEnabled]=useState<boolean|null>(null),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{void window.skillRecorder.studio.deletionStatus().then(r=>{if(r.ok&&r.value)setEnabled(r.value.enabled);else setMessage(tr(r.error??'Löschschutz konnte nicht geladen werden.'));});},[]);
  const save=async(disable=false)=>{setBusy(true);onBusy(true);setMessage('');try{
    if(!disable&&next!==repeat)throw new Error('Die Kennwörter stimmen nicht überein.');
    const r=await window.skillRecorder.studio.configureDeletion(current,disable?'':next);if(!r.ok||!r.value)throw new Error(r.error);
    setEnabled(r.value.enabled);setCurrent('');setNext('');setRepeat('');setMessage(tr(r.value.enabled?'Löschschutz aktiviert.':'Löschschutz deaktiviert.'));
  }catch(e){setMessage(tr(e instanceof Error?e.message:String(e)));}finally{setBusy(false);onBusy(false);}};
  return <section className="deletion-settings"><h3>{tr('Löschen schützen')}</h3><p>{tr('Optionales Kennwort für das Löschen von Aufnahmen, Schritten und Anhängen in dieser App. Kein Schutz gegen direkten Dateizugriff in Windows.')}</p>
    <p>{enabled===null?tr('Wird geladen …'):tr(enabled?'Kennwortschutz aktiv':'Kennwortschutz nicht aktiv')}</p>
    {enabled&&<label>{tr('Bisheriges Löschkennwort')}<input type="password" autoComplete="current-password" value={current} disabled={busy} onChange={e=>setCurrent(e.target.value)} maxLength={256}/></label>}
    <label>{tr('Neues Löschkennwort')}<input type="password" autoComplete="new-password" value={next} disabled={busy} onChange={e=>setNext(e.target.value)} maxLength={256}/></label>
    <label>{tr('Kennwort wiederholen')}<input type="password" autoComplete="new-password" value={repeat} disabled={busy} onChange={e=>setRepeat(e.target.value)} maxLength={256}/></label>
    <small>{tr('Mindestens 8 Zeichen. Zum Ändern oder Abschalten wird das bisherige Kennwort benötigt.')}</small>
    <div className="studio-modal-actions"><button disabled={busy||enabled===null||next.length<8||!repeat||(!!enabled&&!current)} onClick={()=>void save()}>{tr('Kennwort speichern')}</button>{enabled&&<button disabled={busy||!current} onClick={()=>void save(true)}>{tr('Kennwortschutz abschalten')}</button>}</div>
    {message&&<p role="status">{message}</p>}
  </section>;
}
