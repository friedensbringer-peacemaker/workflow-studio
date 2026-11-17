import { useEffect, useRef, useState } from 'react';
import type { StudioStep } from '../common/studio';
import type { StepMaterial } from '../common/step-material';
import { tr, useUiLanguage } from './i18n';
import { Dictation } from './Dictation';

const api = () => window.skillRecorder.studio;
export function StepSupplements({ sessionId, step, disabled, onChange, onActivity, supplementLimit=12000, allowImagePromotion=true, onScreenToGif, onDelete }: {
  sessionId: string; step: StudioStep; disabled: boolean; onDelete?:(id:string,name:string)=>void; supplementLimit?:number; allowImagePromotion?:boolean; onScreenToGif?:(id:string)=>void;
  onChange: (patch: Partial<StudioStep>) => void; onActivity: (active: boolean) => void;
}) {
  const language = useUiLanguage();
  const notesRef=useRef<HTMLTextAreaElement>(null);
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
  const [deviceId,setDeviceId]=useState(()=>localStorage.getItem('studio-note-microphone')??'');
  const [expanded, setExpanded] = useState(!!(step.supplement || step.materials?.length));
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true); const discard = useRef(false);
  const cleanMedia = () => {
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    if (clock.current) clearInterval(clock.current);
    timeout.current = null; clock.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; discard.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      cleanMedia();
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (recording || working) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recording, working]);
  const refreshDevices=async()=>{try{const found=await navigator.mediaDevices.enumerateDevices();if(alive.current)setDevices(found.filter(d=>d.kind==='audioinput'));}catch(e){fail(e);}};
  useEffect(()=>{void refreshDevices();const changed=()=>void refreshDevices();navigator.mediaDevices?.addEventListener('devicechange',changed);return()=>navigator.mediaDevices?.removeEventListener('devicechange',changed);},[]);
  const fail = (e: unknown) => { const names:Record<string,string>={NotFoundError:'Kein Mikrofon verfügbar. Mikrofon anschließen und die Geräteliste aktualisieren.',NotAllowedError:'Mikrofonzugriff wurde nicht erlaubt. Zugriff in den Windows-Datenschutzeinstellungen prüfen.',NotReadableError:'Das Mikrofon ist nicht verfügbar oder wird von einer anderen Anwendung belegt.',OverconstrainedError:'Das gewählte Mikrofon ist nicht mehr verfügbar. Ein anderes Gerät wählen.'};if (alive.current) setError(tr(e instanceof Error?(names[e.name]??e.message):String(e))); };
  const active = (value: boolean) => { if (alive.current) { if (value) setExpanded(true); setWorking(value); onActivity(value); } };
  const addMaterials = async () => {
    setError(''); active(true);
    try {
      const result = await api().importMaterials(sessionId, 20 - (step.materials?.length ?? 0));
      if (!result.ok || !result.value) throw new Error(result.error);
      if ((step.materials?.length ?? 0) + result.value.length > 20) throw new Error('Höchstens 20 Dateien pro Schritt. Weniger Dateien auswählen.');
      if (alive.current && result.value.length) onChange({ materials: [...(step.materials ?? []), ...result.value] });
    } catch (e) { fail(e); } finally { active(false); }
  };
  const startVoice = async () => {
    setError(''); active(true); discard.current = false;
    try {
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) throw new Error('Sprachaufnahme wird hier nicht unterstützt. Audiodatei hinzufügen.');
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: deviceId?{deviceId:{exact:deviceId}}:true, video: false });
      void refreshDevices();
      if (!alive.current) { microphone.getTracks().forEach(track => track.stop()); return; }
      stream.current = microphone;
      const capture = new MediaRecorder(microphone, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 64000 });
      recorder.current = capture;
      const chunks: Blob[] = []; let size = 0;
      capture.ondataavailable = event => {
        if (event.data.size) { chunks.push(event.data); size += event.data.size; }
        if (size > 5 * 1024 * 1024 && capture.state === 'recording') capture.stop();
      };
      capture.onerror = () => {
        discard.current = true; fail(new Error('Sprachaufnahme fehlgeschlagen.'));
        if (capture.state === 'recording') capture.stop();
        else { cleanMedia(); setRecording(false); active(false); }
      };
      capture.onstop = () => {
        cleanMedia(); recorder.current = null;
        if (!alive.current) return;
        setRecording(false);
        void (async () => {
          try {
            if (discard.current) return;
            const bytes = new Uint8Array(await new Blob(chunks, { type: capture.mimeType }).arrayBuffer());
            const result = await api().saveVoice(sessionId, bytes);
            if (!result.ok || !result.value) throw new Error(result.error);
            if (alive.current) onChange({ materials: [...(step.materials ?? []), result.value] });
          } catch (e) { fail(e); } finally { active(false); }
        })();
      };
      capture.start(1000); setRecording(true); setElapsed(0);
      const started = Date.now();
      clock.current = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
      timeout.current = setTimeout(() => { if (capture.state === 'recording') capture.stop(); }, 300000);
      microphone.getAudioTracks()[0]?.addEventListener('ended', () => { if (capture.state === 'recording') capture.stop(); }, { once: true });
    } catch (e) { cleanMedia(); fail(e); active(false); }
  };
  const stopVoice = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };
  const transcribe = async (material: StepMaterial) => {
    setError(''); active(true);
    try {
      const result = await api().transcribeMaterial(sessionId, material.id, language);
      if (!result.ok || !result.value) throw new Error(result.error);
      const text = [step.supplement, `${tr('Sprachnotiz')}: ${result.value}`].filter(Boolean).join('\n\n');
      if (text.length > supplementLimit) throw new Error('Zu viel Ergänzungstext. Vorhandene Notizen zuerst kürzen.');
      if (alive.current) onChange({ supplement: text });
    } catch (e) { fail(e); } finally { active(false); }
  };
  const setupModel = async () => {
    setError(''); setStatus(''); active(true);
    try {
      const result = await window.skillRecorder.downloadNarrationModel();
      if (!result.ok) throw new Error(result.error);
      if (alive.current) setStatus(tr('Sprachmodell bereit. Sprachnotiz jetzt lokal transkribieren.'));
    } catch (e) { fail(e); } finally { active(false); }
  };
  return <details className="studio-supplements" open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}>
    <summary aria-disabled={working} onClick={event => { if (working) event.preventDefault(); }}>{tr('Ergänzende Informationen')}<span>{step.materials?.length ? tr('{count} Dateien', { count: step.materials.length }) : tr(step.supplement ? 'Mit Inhalt' : 'Notiz, Sprache oder Datei')}</span></summary>
    <div className="studio-supplement-body">
    <p>{tr('Etwas vergessen? Ergänze diesen Schritt mit einer Notiz, einer Sprachaufnahme oder zusätzlichen Dateien.')}</p>
    <label>{tr('Zusätzliche Notizen')}<textarea ref={notesRef} value={step.supplement ?? ''} maxLength={supplementLimit} rows={3} disabled={disabled || working} onChange={e => onChange({ supplement: e.target.value })}/><Dictation target={notesRef} disabled={disabled||working}/></label>
    <div className="studio-material-actions">
      <button disabled={disabled || working || (step.materials?.length ?? 0) >= 20} onClick={() => void addMaterials()}>{tr('Bilder / Dokumente / Audio hinzufügen')}</button>
      {!recording ? <button disabled={disabled || working || (step.materials?.length ?? 0) >= 20} onClick={() => void startVoice()}>{tr('Sprachnotiz aufnehmen')}</button> : <>
        <span className="studio-voice-status" role="status">{tr('Mikrofon aktiv')} · {elapsed}s / 300s</span>
        <button className="studio-primary" onClick={stopVoice}>{tr('Stoppen & hinzufügen')}</button>
        <button onClick={() => { discard.current = true; stopVoice(); }}>{tr('Aufnahme verwerfen')}</button>
      </>}
    </div>
    <details className="note-microphone"><summary>{tr('Mikrofon für Sprachnotizen')}</summary><label>{tr('Mikrofon')}<select aria-label={tr('Mikrofon')} value={deviceId} disabled={disabled||working} onChange={e=>{setDeviceId(e.target.value);localStorage.setItem('studio-note-microphone',e.target.value);setError('');}}><option value="">{tr('Windows-Standardmikrofon')}</option>{deviceId&&!devices.some(d=>d.deviceId===deviceId)&&<option value={deviceId}>{tr('Gespeichertes Mikrofon nicht verbunden')}</option>}{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`${tr('Mikrofon')} ${i+1}`}</option>)}</select></label><button disabled={disabled||working} onClick={()=>void refreshDevices()}>{tr('Geräteliste aktualisieren')}</button>{!devices.length&&<p>{tr('Aktuell wird kein Mikrofon erkannt. Eine Audiodatei kann alternativ hinzugefügt werden.')}</p>}</details>
    <p className="studio-material-note">{tr('Nur lokal gespeichert. Keine Passwörter oder vertraulichen Angaben aufnehmen. Mikrofon nur nach Start, maximal 5 Minuten. Ergänzungen anschließend speichern.')}</p>
    <p className="studio-material-note">{tr('Zusatzdateien werden von den neuen Textadaptern nicht übertragen. Ergänzende Notizen und eingefügte Transkripte zählen beim bestätigten Textanalyse-Aufruf zum Schritttext.')}</p>
    {(step.materials ?? []).some(m => m.kind === 'audio') && <p className="studio-material-note"><button disabled={disabled || working} onClick={() => void setupModel()}>{tr('Sprachmodell einrichten (~252 MB Download)')}</button> {tr('Transkription lokal; Sprache gemäß DE/EN-Auswahl. Maximal 5 Minuten pro Audiodatei.')}</p>}
    <div className="studio-material-list">{(step.materials ?? []).map(material => <MaterialCard key={material.id} sessionId={sessionId} material={material} disabled={disabled || working}
      onDelete={onDelete?()=>onDelete(material.id,material.name):undefined} onScreenToGif={onScreenToGif?()=>onScreenToGif(material.id):undefined} onError={fail} onTranscribe={() => void transcribe(material)} onSetImage={allowImagePromotion?()=>onChange({image:material,imagePointer:undefined}):undefined} onRemove={() => onChange({ materials: step.materials?.filter(m => m.id !== material.id) })}/>)}</div>
    {working && !recording && <p role="status">{tr('Zusatzmaterial wird verarbeitet …')}</p>}
    {status && <p role="status">{status}</p>}
    {error && <p className="studio-error" role="alert">{error}</p>}
    </div></details>;
}

function MaterialCard({ sessionId, material, disabled, onError, onTranscribe, onSetImage, onRemove, onScreenToGif, onDelete }: {
  sessionId: string; material: StepMaterial; disabled: boolean;
  onDelete?:()=>void; onError: (e: unknown) => void; onTranscribe: () => void; onSetImage?:()=>void; onScreenToGif?:()=>void; onRemove: () => void;
}) {
  const [preview, setPreview] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    if (material.kind !== 'document') void api().material(sessionId, material.id).then(result => {
      if (disposed) return;
      if (result.ok && result.value) setPreview(result.value); else setError(tr('Vorschau nicht verfügbar.'));
    }).catch(() => { if (!disposed) setError(tr('Vorschau nicht verfügbar.')); });
    return () => { disposed = true; };
  }, [sessionId, material.id, material.kind]);
  return <article className="studio-material-card">
    <strong>{material.name}</strong><small>{(material.size / 1024).toFixed(0)} KB</small>
    {material.kind === 'image' && preview && <img src={preview} alt={material.name}/>}
    {material.kind === 'video' && preview && <video controls preload="metadata" src={preview} aria-label={material.name}/> }
    {material.kind === 'audio' && preview && <audio controls preload="none" src={preview} aria-label={material.name}/>}
    {error && <p>{error}</p>}
    <div className="studio-material-actions">
      {onScreenToGif&&(material.kind==='image'||material.kind==='video')&&<button disabled={disabled} onClick={onScreenToGif}>{tr('Mit ScreenToGif bearbeiten')}</button>}
      {material.kind==='image'&&onSetImage&&<button disabled={disabled} onClick={onSetImage}>{tr('Als Schrittbild verwenden')}</button>}
      {material.kind === 'document' && <button disabled={disabled} onClick={async () => { try { const result = await api().openMaterial(sessionId, material.id); if (!result.ok) throw new Error(result.error); } catch (e) { onError(e); } }}>{tr('Dokument öffnen')}</button>}
      {material.kind === 'audio' && <button disabled={disabled} onClick={onTranscribe}>{tr('Lokal transkribieren')}</button>}
      <button disabled={disabled} onClick={onDelete??onRemove}>{tr(onDelete?'Anhang löschen':'Zuordnung entfernen')}</button>
    </div>
  </article>;
}
