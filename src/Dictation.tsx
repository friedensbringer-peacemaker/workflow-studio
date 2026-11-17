import { useEffect, useRef, useState, type RefObject } from 'react';
import { tr } from './i18n';

/** Keeps dictation at the existing caret, without replacing the user's text. */
export function Dictation({target,disabled=false,fieldKey}: {target:RefObject<HTMLTextAreaElement|null>;disabled?:boolean;fieldKey?:string}) {
  const [open,setOpen]=useState(false),[error,setError]=useState('');
  const insertion=useRef({position:0,value:''});
  const hasCursor=useRef(false);
  useEffect(()=>{
    const node=target.current;
    hasCursor.current=!!node&&document.activeElement===node;
    const focused=()=>{hasCursor.current=true;};
    node?.addEventListener('focus',focused);
    return()=>node?.removeEventListener('focus',focused);
  },[target,fieldKey]);
  if(!navigator.userAgent.includes('Windows'))return null;
  const begin=async()=>{
    setOpen(false);setError('');
    // Wait for the modal focus trap to be removed before restoring the text caret.
    requestAnimationFrame(()=>{const node=target.current;if(!node?.isConnected||node.disabled||node.readOnly)return;
      const position=node.value===insertion.current.value?Math.min(insertion.current.position,node.value.length):node.value.length;
      node.focus();
      // Collapse any previous selection. Windows replaces selected text, so the
      // dictation button always inserts after it and never submits a text range.
      node.setSelectionRange(position,position);
      void window.skillRecorder.studio.dictate(true).then(r=>{if(!r.ok)setError(tr(r.error??'Windows-Diktat konnte nicht geöffnet werden. Im Textfeld Windows + H drücken.'));}).catch(()=>setError(tr('Im Textfeld Windows + H drücken.')));
    });
  };
  return <span className="dictation-control"><button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>{const node=target.current;if(!node)return;insertion.current={position:hasCursor.current?node.selectionEnd:node.value.length,value:node.value};setOpen(true);}}>{tr('Diktieren')} <kbd>Win + H</kbd></button>
    {error&&<span role="alert">{error}</span>}
    {open&&<DictationConsent onCancel={()=>setOpen(false)} onStart={()=>void begin()}/>}
  </span>;
}
function DictationConsent({onCancel,onStart}: {onCancel:()=>void;onStart:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="studio-modal dictation-dialog" aria-label={tr('Windows-Diktat')} onCancel={e=>{e.preventDefault();onCancel();}}>
    <h2>{tr('Windows-Diktat')}</h2><p>{tr('Windows schreibt das Gesprochene direkt in dieses Feld. Es entsteht keine Audiodatei im Studio.')}</p><p>{tr('Die Windows-Spracheingabe verwendet Microsofts Online-Spracherkennung. Internet und ein eingerichtetes Mikrofon sind erforderlich. Die Diktatsprache folgt der Windows-Eingabesprache.')}</p>
    <div className="studio-modal-actions"><button autoFocus onClick={onCancel}>{tr('Abbrechen')}</button><button className="studio-primary" onClick={onStart}>{tr('Windows-Diktat starten')}</button></div>
  </dialog>;
}
