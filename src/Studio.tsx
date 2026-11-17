import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { applySuggestion, DEFAULT_STUDIO_SETTINGS, type LocalProviderResult, type ProviderProfile, type StudioDocument, type StudioSettings, type StudioStep, type StudioSuggestion } from '../common/studio';
import type { SessionSummary } from '../common/ipc';
import './Studio.css';
import { StudioIcon as Icon } from './StudioIcon';
import { tr, useUiLanguage } from './i18n';
import { StepSupplements } from './StepSupplements';
import { GuideExportDialog } from './GuideExportDialog';
import { WorkflowKnowledge } from './WorkflowKnowledge';
import { ScreenToGifDialog } from './ScreenToGifDialog';
import { StepImageEditor } from './StepImageEditor';
import { mergeSteps, splitStep, stepEvidence } from '../common/step-organization';

import { BrandMark } from './Branding';
import { AppSettings } from './AppSettings';
import { ProcessReview } from './ProcessReview';
import { WikiPublish } from './WikiPublish';
import {RecordingNotes} from './RecordingNotes';
import {attachNarration} from '../common/studio-narration';
import {ContentTags} from './ContentTags';
import {stepContentTags} from '../common/step-content';
import { ActionMenu } from './ActionMenu';
import { Dictation } from './Dictation';
import { DeleteDialog } from './DeleteDialog';

const api = () => window.skillRecorder.studio;
const message = (error: unknown) => tr(error instanceof Error ? error.message : String(error));
const fitGoal = (node: HTMLTextAreaElement | null) => {
  if (!node) return;
  node.style.height = 'auto'; node.style.height = `${node.scrollHeight + 2}px`;
};

export function Studio() {
  const language = useUiLanguage();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [document, setDocument] = useState<StudioDocument | null>(null);
  const [settings, setSettings] = useState<StudioSettings>(structuredClone(DEFAULT_STUDIO_SETTINGS));
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [image, setImage] = useState('');
  const [imageError, setImageError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showWiki, setShowWiki] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [consent, setConsent] = useState(false);
  const [imageConsent,setImageConsent]=useState(false);
  const [knowledge,setKnowledge]=useState<'interview'|'skill'|null>(null);
  useEffect(()=>{setImageConsent(false);},[settings.selected]);
  const [suggestion, setSuggestion] = useState<StudioSuggestion | null>(null);
  const [undo, setUndo] = useState<StudioDocument | null>(null);
  const [search, setSearch] = useState('');
  const [expandedImage, setExpandedImage] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [deletion,setDeletion]=useState<{title:string;description:string;onConfirm:(password:string)=>Promise<void>}|null>(null);
  const whyRef=useRef<HTMLTextAreaElement>(null), exceptionsRef=useRef<HTMLTextAreaElement>(null);
  const allowClose = useRef(false);
  const [showImageEditor,setShowImageEditor]=useState(false);
  const [screenToGif,setScreenToGif]=useState<{materialId?:string}|null>(null);
  const detailRef=useRef<HTMLTextAreaElement>(null);
  const detailCursor=useRef<{id:string;offset:number}|null>(null);
  const loadToken = useRef(0);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const current = document?.steps[selected];
  const profile = settings.profiles.find(p => p.id === settings.selected)!;
  const sessionTitle = (s: SessionSummary) => (document?.sessionId === s.id ? document.title : s.studio?.title) || s.analysis?.title || tr('Prozessaufnahme');
  const visibleSessions = sessions.filter(s => `${sessionTitle(s)} ${s.startedAt ? new Date(s.startedAt).toLocaleDateString(language === 'de' ? 'de-AT' : 'en-GB') : ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  useLayoutEffect(() => { fitGoal(goalRef.current); }, [document?.intent]);
  useEffect(() => {
    const resize = () => fitGoal(goalRef.current);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => api().onSettingsChanged(next => { setSettings(next); setConsent(false);setImageConsent(false); }), []);
  useEffect(()=>{
    const id=document?.sessionId;if(!id)return;
    let disposed=false;
    const sync=async()=>{const r=await api().narrationSource(id);if(disposed||!r.ok||!r.value)return;setDocument(current=>{if(!current||current.sessionId!==id)return current;const next=attachNarration(current,r.value!);if(next!==current)setDirty(true);return next;});};
    const off=window.skillRecorder.onNarrationStatusChanged(status=>{if(status.phase==='idle')void sync();});
    void sync();return()=>{disposed=true;off();};
  },[document?.sessionId]);

  const refresh = useCallback(async () => setSessions(await window.skillRecorder.listSessions()), []);
  const open = useCallback(async (id: string) => {
    const token = ++loadToken.current;
    setError(''); setBusy(tr("Sitzung laden"));
    try {
      const result = await api().load(id);
      if (token !== loadToken.current) return;
      if (!result.ok || !result.value) throw new Error(result.error);
      setDocument(result.value); setSelected(0); setDirty(false); setSuggestion(null); setUndo(null); setConsent(false);setImageConsent(false);
    } catch (e) { if (token === loadToken.current) setError(message(e)); }
    finally { if (token === loadToken.current) setBusy(''); }
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        const [list, config] = await Promise.all([window.skillRecorder.listSessions(), api().settings()]);
        setSessions(list); if (config.ok && config.value) setSettings(config.value);
        if (list.length) await open(list[0].id);
      } catch (e) { setError(message(e)); }
    })();
    return window.skillRecorder.onStatusChanged(s => { if (s.state === 'idle') void refresh(); });
  }, [open, refresh]);
  useEffect(() => {
    let disposed = false; setImage(''); setImageError('');
    if (document && (current?.image || current?.frame)) void (current.image ? api().material(document.sessionId,current.image.id) : api().frame(document.sessionId, current.frame!)).then(r => {
      if (disposed) return;
      if (r.ok && r.value) setImage(r.value); else setImageError(r.error ?? tr("Bild nicht verfügbar."));
    }).catch(e => { if (!disposed) setImageError(message(e)); });
    return () => { disposed = true; };
  }, [document?.sessionId, current?.frame,current?.image?.id]);
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!allowClose.current && (dirty || busy)) {
        event.preventDefault(); event.returnValue = '';
        setShowClose(true);
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty, busy]);

  const edit = (next: StudioDocument) => { setDocument(next); setDirty(true); setNotice(''); setSuggestion(null); };
  const editStep = (patch: Partial<StudioStep>) => {
    if (!document) return;
    edit({ ...document, steps: document.steps.map((step, i) => i === selected ? { ...step, ...patch } : step) });
  };
  const persist = async (next:StudioDocument,password?:string) => {
    setError('');setBusy(tr('Speichern'));
    try {
      const r=await api().save(next,password);if(!r.ok||!r.value)throw new Error(r.error);
      setDocument(r.value);setDirty(false);setNotice(tr('Lokal gespeichert'));await refresh();return r.value;
    } finally {setBusy('');}
  };
  const save = async () => {
    if(!document)return false;
    try {await persist(document);return true;} catch(e) {
      if(e instanceof Error&&e.message==='Löschkennwort erforderlich.')setDeletion({title:tr('Entfernte Inhalte bestätigen'),description:tr('Diese Änderung entfernt Schritte oder Dateizuordnungen. Zum Speichern ist das Löschkennwort erforderlich.'),onConfirm:async password=>{await persist(document,password);}});
      else setError(message(e));return false;
    }
  };
  const switchSession = async (id: string) => {
    if (dirty && !window.confirm(tr("Ungespeicherte Änderungen verwerfen und andere Sitzung öffnen?"))) return;
    await open(id);
  };
  const add = () => {
    if (!document) return;
    const next = { ...document, steps: [...document.steps, { id: crypto.randomUUID(), title: tr("Neuer Schritt"), detail: '', why: '', exceptions: '', app: '', source: 'manual' as const }] };
    edit(next); setSelected(next.steps.length - 1);
  };
  const move = (direction: number) => {
    if (!document || !current) return;
    const nextIndex = selected + direction;
    if (nextIndex < 0 || nextIndex >= document.steps.length) return;
    const steps = [...document.steps]; [steps[selected], steps[nextIndex]] = [steps[nextIndex], steps[selected]];
    edit({ ...document, steps }); setSelected(nextIndex);
  };
  const remove = () => {
    if(!document||!current)return;
    setDeletion({title:tr('Schritt löschen?'),description:current.title+' · '+tr('Der aktuelle Prozess wird gespeichert und dieser Schritt entfernt. Die Originalaufnahme bleibt erhalten.'),onConfirm:async password=>{
      const before=structuredClone(document);
      const next={...document,steps:document.steps.filter(s=>s.id!==current.id),interview:document.interview?.filter(q=>q.stepId!==current.id)};
      const saved=await persist(next,password);setUndo({...before,updatedAt:saved.updatedAt});setSelected(Math.max(0,selected-1));
    }});
  };
  const deleteMaterial=(id:string,name:string)=>{
    if(!document)return;
    setDeletion({title:tr('Anhang löschen?'),description:name+' · '+tr('Entfernt den Anhang aus allen Schritten dieses Prozesses und speichert die aktuellen Änderungen. Die Ursprungsdatei bleibt unverändert. Eine lokale Wiederherstellungskopie bleibt erhalten.'),onConfirm:async password=>{
      setBusy(tr('Anhang löschen'));
      try{const r=await api().deleteMaterial(document,id,password);if(!r.ok||!r.value)throw new Error(r.error);setDocument(r.value);setDirty(false);setUndo(null);setNotice(tr('Anhang gelöscht'));await refresh();}finally{setBusy('');}
    }});
  };
  const deleteRecording=()=>{
    if(!document)return;
    const id=document.sessionId;
    setDeletion({title:tr('Aufnahme endgültig löschen?'),description:document.title+' · '+tr('Löscht diese Aufnahme mit allen Schritten, Videos, Sprachaufnahmen und Anhängen endgültig. Ungespeicherte Änderungen dieser Aufnahme gehen ebenfalls verloren.'),onConfirm:async password=>{
      setBusy(tr('Aufnahme löschen'));
      try{const r=await window.skillRecorder.deleteSession(id,password);if(!r.ok)throw new Error(r.error);++loadToken.current;setDocument(null);setDirty(false);setUndo(null);setSelected(0);setImage('');setSuggestion(null);const list=await window.skillRecorder.listSessions();setSessions(list);if(list.length)await open(list[0].id);}finally{setBusy('');}
    }});
  };
  const analyze = async () => {
    if (!document || !consent) return;
    setError(''); setBusy(tr('Analyse mit {provider}', { provider: tr(profile.name) })); setSuggestion(null);
    try {
      if (profile.kind === 'copilot') {
        const r = await window.skillRecorder.analyze(document.sessionId);
        if (!r.ok || !r.analysis) throw new Error(r.error);
        setSuggestion({ title: r.analysis.title, intent: r.analysis.intent, provider: profile.name,
          steps: r.analysis.steps.map((step, i) => ({ id: document.steps[i]?.id ?? step.id, title: step.title, detail: step.detail,
            why: '', exceptions: '', app: step.apps.join(', '), source: 'ai' })) });
      } else {
        const r = await api().analyze(document, profile.id, consent, imageConsent);
        if (!r.ok || !r.value) throw new Error(r.error); setSuggestion(r.value);
      }
    } catch (e) { setError(message(e)); } finally { setBusy(''); setConsent(false); }
  };
  const createDocument = async () => {
    if (dirty && !window.confirm(tr("Ungespeicherte Änderungen verwerfen und neuen Prozess anlegen?"))) return;
    setError('');
    try { const r = await api().createDocument(); if (!r.ok || !r.value) throw new Error(r.error); await refresh(); await open(r.value); }
    catch (e) { setError(message(e)); }
  };

  return <div className="studio">
    <aside className="studio-sidebar">
      <BrandMark className="studio-brand"/>
      <div className="studio-side-heading"><span>{tr("Projekte")}</span><button onClick={() => void refresh()} disabled={!!busy} title={tr("Sitzungen aktualisieren")} aria-label={tr("Sitzungen aktualisieren")}><Icon name="refresh"/></button></div>
      <input className="studio-session-search" type="search" aria-label={tr('Projekte suchen')} placeholder={tr('Projekte suchen')} value={search} onChange={e => setSearch(e.target.value)}/>
      <nav className="studio-sessions" aria-label={tr("Projekte")}>{visibleSessions.map(s => <button key={s.id} className={document?.sessionId === s.id ? 'active' : ''} aria-current={document?.sessionId === s.id ? 'page' : undefined} disabled={!!busy} onClick={() => void switchSession(s.id)}>
        <div><strong>{sessionTitle(s)}</strong><small>{s.startedAt ? new Date(s.startedAt).toLocaleString(language === 'de' ? 'de-AT' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : s.id}</small>{document?.sessionId===s.id?<ContentTags tags={[...document.steps.flatMap(stepContentTags),...(s.hasVideo?['Video' as const]:[]),...(s.hasAudio?['Sprache' as const]:[])]}/>:<ContentTags tags={[...(s.studio?.contentTags??[]),...(s.hasAudio?['Sprache' as const]:[]),...(s.hasVideo?['Video' as const]:[])]}/>}</div>
      </button>)}</nav>
      {!visibleSessions.length && <p className="studio-search-empty">{tr(search ? 'Keine passenden Projekte.' : 'Noch keine Projekte.')}</p>}

      <div className="studio-local"><Icon name="shield"/><p>{tr('Lokal gespeichert.')}<br/>{tr('KI nur auf Wunsch.')}</p></div>
    </aside>
    <aside className="studio-step-list" aria-label={tr('Schritte')}>
      <div className="studio-section-head"><h2>{tr("Schritte")}{document && <span>{document.steps.length}</span>}</h2>{document && <button onClick={add} disabled={!!busy} title={tr("Schritt hinzufügen")} aria-label={tr("Schritt hinzufügen")}><Icon name="plus"/></button>}</div>
      <nav className="studio-step-scroll" aria-label={tr('Prozessschritte')}>{document?.steps.map((s, i) => <button key={s.id} disabled={!!busy} className={`studio-step ${i === selected ? 'selected' : ''}`} aria-current={i === selected ? 'step' : undefined} onClick={() => setSelected(i)}><span className="studio-number">{String(i + 1).padStart(2, '0')}</span><div><strong>{s.title || tr("Unbenannter Schritt")}</strong><ContentTags steps={[s]}/></div></button>)}{!document ? <p className="studio-empty-small">{tr('Wähle ein Projekt aus.')}</p> : !document.steps.length && <p className="studio-empty-small">{tr("Noch keine Schritte. Ergänze den ersten Schritt über „Schritt hinzufügen“.")}</p>}</nav>
      {undo && document && <button className="studio-undo" disabled={!!busy} onClick={() => { edit({...undo,updatedAt:document.updatedAt}); setUndo(null); setSelected(0); }}><Icon name="undo"/> {tr("Letzte Änderung zurück")}</button>}
    </aside>
    <main className="studio-main">
      <header className="studio-top">{document ? <label className="studio-title-field">{tr("Prozesstitel")}<input aria-label={tr("Prozesstitel")} value={document.title} onChange={e => edit({ ...document, title: e.target.value })} disabled={!!busy} maxLength={500}/></label> : <h1>{tr('Prozess bearbeiten')}</h1>}<div className="studio-header-actions">{document && <button className="studio-primary" disabled={!!busy || !dirty} onClick={() => void save()}><Icon name="save"/> {tr("Speichern")}</button>}<AppSettings disabled={!!busy} onProvider={() => setShowSettings(true)} tools={<div className="settings-tools"><button data-close-settings className="studio-tool" onClick={() => void createDocument()} disabled={!!busy}><Icon name="plus"/> {tr("Neuen Prozess anlegen")}</button>
      <button data-close-settings className="studio-tool" disabled={!!busy} onClick={()=>setScreenToGif({})}><Icon name="edit"/>{tr("ScreenToGif einrichten")}</button>
      <button data-close-settings className="studio-legacy" disabled={!!busy} onClick={() => {
        if (dirty && !window.confirm(tr("Ungespeicherte Änderungen verwerfen und die bisherige Skill-Ansicht öffnen?"))) return;
        window.location.replace('#legacy-library'); window.location.reload();
      }}>{tr("Skill-Ansicht (Copilot)")}</button></div>}/></div></header>
      <div className="studio-status" role="status"><span></span><span className={dirty ? 'studio-unsaved' : undefined}>{busy ? `${busy} …` : dirty ? tr("Ungespeicherte Änderungen") : notice || tr('Lokal gespeichert.')}</span></div>
      {error && <div className="studio-error" role="alert">{error}<button onClick={() => setError('')} aria-label={tr("Fehlermeldung schließen")}><Icon name="close"/></button></div>}
      {document ? <>
        <section className="studio-document">
          <label className="studio-intent">{tr("Ziel des Prozesses")}<textarea ref={goalRef} onInput={e => fitGoal(e.currentTarget)} aria-label={tr("Prozessziel")} value={document.intent} onChange={e => edit({ ...document, intent: e.target.value })} placeholder={tr("Was soll mit diesem Ablauf erreicht werden?")} rows={1} disabled={!!busy} maxLength={6000}/><Dictation fieldKey={document.sessionId} target={goalRef} disabled={!!busy}/></label>
        </section>
        <section className="studio-step-detail">{current ? <>
          <div className="studio-step-heading"><label className="studio-step-title">{tr("Schritttitel")}<input aria-label={tr("Schritttitel")} value={current.title} onChange={e => editStep({ title: e.target.value })} disabled={!!busy} maxLength={500}/></label>
            <ActionMenu label={tr('Schrittaktionen')} disabled={!!busy}>
              <button disabled={!!busy || selected === 0} onClick={() => move(-1)}><Icon name="up"/>{tr("Schritt nach oben")}</button>
              <button disabled={!!busy || selected === document.steps.length - 1} onClick={() => move(1)}><Icon name="down"/>{tr("Schritt nach unten")}</button>
              <button disabled={!!busy||selected>=document.steps.length-1} onClick={()=>{try{setUndo(structuredClone(document));edit(mergeSteps(document,selected));}catch(e){setError(message(e));}}}>{tr('Mit nächstem Schritt zusammenführen')}</button>
              <button disabled={!!busy||document.steps.length>=1000} onClick={()=>{try{setUndo(structuredClone(document));edit(splitStep(document,selected,crypto.randomUUID(),detailCursor.current?.id===current.id?detailCursor.current.offset:Math.floor(current.detail.length/2)));}catch(e){setError(message(e));}}}>{tr('Schritt teilen')}</button>
              <button disabled={!!busy} onClick={()=>setScreenToGif({})}><Icon name="edit"/>{tr("Animation mit ScreenToGif")}</button>
              <button className="action-menu-danger" disabled={!!busy} onClick={remove}>{tr("Schritt entfernen")}</button>
            </ActionMenu>
          </div>
          {stepEvidence(current).length>1&&<label>{tr('Schrittbild auswählen')}<select disabled={!!busy} value={current.frame??''} onChange={e=>editStep({frame:e.target.value,image:undefined,imagePointer:undefined})}>{stepEvidence(current).map((e,i)=><option key={e.id} value={e.frame}>{tr('Bild {count}',{count:i+1})}</option>)}</select></label>}
          <div className="studio-frame">{image ? <button className="studio-image-button" onClick={() => setExpandedImage(true)} aria-label={tr('Bild vergrößern')}><div className="studio-image"><img src={image} alt={tr('Aufgezeichneter Bildschirm zu {title}', { title: current.title })}/>{(current.image ? current.imagePointer : current.pointer) && <span className="studio-click-position" role="img" aria-label={tr('Klickposition')} style={{ left: `${(current.image ? current.imagePointer! : current.pointer!).x * 100}%`, top: `${(current.image ? current.imagePointer! : current.pointer!).y * 100}%` }}/>}</div><span className="studio-image-hint"><Icon name="monitor"/>{tr('Bild vergrößern')}</span></button> : <div className="studio-frame-empty"><Icon name="monitor"/><strong>{imageError || (current.frame ? tr("Bild wird geladen …") : tr("Ein Schritt braucht nicht immer ein Bild."))}</strong><small>{current.frame ? tr("Lokale Bildschirmvorschau") : tr("Hier bleibt Platz für die visuelle Erklärung deines Ablaufs.")}</small></div>}</div>
          {image&&<div className="studio-step-organization"><button disabled={!!busy} onClick={()=>setShowImageEditor(true)}>{tr('Bild bearbeiten')}</button>{current.image&&<button disabled={!!busy} onClick={()=>editStep({image:undefined,imagePointer:undefined})}>{tr('Original verwenden')}</button>}</div>}
          <label>{tr("Was passiert hier?")}<textarea ref={detailRef} onSelect={e=>{detailCursor.current={id:current.id,offset:e.currentTarget.selectionStart};}} aria-label={tr("Schrittbeschreibung")} value={current.detail} onChange={e => editStep({ detail: e.target.value })} rows={3} disabled={!!busy} maxLength={12000}/><Dictation fieldKey={`${document.sessionId}:${current.id}`} target={detailRef} disabled={!!busy}/></label>
          <RecordingNotes step={current} disabled={!!busy} onChange={editStep}/>
          <details className="studio-context" key={`context-${current.id}`} open={!!(current.why || current.exceptions)}><summary>{tr('Hintergründe & Ausnahmen')}<span>{tr(current.why || current.exceptions ? 'Mit Inhalt' : 'Optional')}</span></summary><div className="studio-reason-grid"><label>{tr("Warum ist das wichtig?")}<textarea ref={whyRef} aria-label={tr("Begründung")} value={current.why} onChange={e => editStep({ why: e.target.value })} placeholder={tr("Entscheidung, Voraussetzung oder Hintergrund")} rows={3} disabled={!!busy} maxLength={6000}/><Dictation fieldKey={`${document.sessionId}:${current.id}`} target={whyRef} disabled={!!busy}/></label><label>{tr("Ausnahmen & offene Fragen")}<textarea ref={exceptionsRef} aria-label={tr("Ausnahmen")} value={current.exceptions} onChange={e => editStep({ exceptions: e.target.value })} placeholder={tr("Wann läuft es anders? Was fehlt noch?")} rows={3} disabled={!!busy} maxLength={6000}/><Dictation fieldKey={`${document.sessionId}:${current.id}`} target={exceptionsRef} disabled={!!busy}/></label></div></details>
          <StepSupplements onDelete={deleteMaterial} onScreenToGif={materialId=>setScreenToGif({materialId})} key={`${document.sessionId}:${current.id}`} sessionId={document.sessionId} step={current} disabled={!!busy} onChange={editStep} onActivity={active => setBusy(active ? tr('Zusatzmaterial bearbeiten') : '')}/>
        </> : <div className="studio-empty-small">{tr("Wähle einen Schritt aus oder ergänze einen neuen.")}</div>}</section>
        <section className="studio-process-tools"><h2>{tr("Werkzeuge für den gesamten Prozess")}</h2><details className="studio-ai" open={suggestion ? true : undefined}><summary className="studio-ai-summary"><Icon name="sparkle"/><span>{tr('Mit KI überarbeiten')}<small>{tr('Optional · du entscheidest über die Übermittlung')}</small></span></summary><div className="studio-ai-body"><p>{tr("KI strukturiert den gezeigten Text. Du prüfst und übernimmst den Vorschlag.")}</p>
          <div className="studio-ai-controls"><select aria-label={tr("KI-Anbieter auswählen")} value={settings.selected} disabled={!!busy} onChange={e => { const next = { ...settings, selected: e.target.value }; setSettings(next); setConsent(false); void api().saveSettings(next, {}).then(r => { if (!r.ok) setError(r.error ?? tr("Anbieter konnte nicht gespeichert werden.")); }); }}>{settings.profiles.map(p => <option key={p.id} value={p.id}>{tr(p.name)}</option>)}</select><span className="studio-model-label">{profile.model || (profile.kind === 'codex' ? tr("CLI-Standardmodell") : profile.kind === 'copilot' ? tr("Bestehende Analyse") : tr("Modell noch wählen"))}</span><button onClick={() => setShowSettings(true)} disabled={!!busy}>{tr("Konfigurieren")}</button></div>
          <label className="studio-consent"><input type="checkbox" checked={consent} disabled={!!busy} onChange={e => setConsent(e.target.checked)}/><span>{profile.kind === 'copilot' ? tr("Aufnahme, Bilder und Transkript über die bestehende geschützte Copilot-Analyse auswerten.") : profile.kind === 'ollama' ? tr("Den gezeigten Schritttext und das Transkript an meinen gewählten Ollama-Server senden.") : tr('Den gezeigten Schritttext und das Transkript an {provider} senden.', { provider: tr(profile.name) })}<small>{profile.kind === 'copilot' ? tr("Der vorhandene Copilot-Ablauf berücksichtigt die Originalaufnahme.") : tr("Videos und Zusatzdateien werden nicht übertragen. Schrittbilder nur bei gesonderter Auswahl unten.")}</small></span></label>
          {profile.vision && profile.kind!=='copilot' && <label className="studio-consent"><input type="checkbox" checked={imageConsent} disabled={!!busy} onChange={e=>{setImageConsent(e.target.checked);setConsent(false);}}/><span>{tr('Bis zu vier Schrittbilder mitsenden.')}<small>{tr('Verwendet die ersten vier bebilderten Schritte, bevorzugt bearbeitete Bilder. Bei aktivem erweitertem Schutz ist OCR erforderlich. Bilder vorab auf vertrauliche Inhalte prüfen.')}</small></span></label>}
          <div className="studio-ai-actions"><button className="studio-secondary" onClick={() => void analyze()} disabled={!!busy || !consent}><Icon name="sparkle"/> {tr("Schritte mit KI prüfen")}</button>{/^Analys/.test(busy) && <button onClick={() => { void api().cancel(); void window.skillRecorder.cancelAnalysis(document.sessionId); }}>{tr("Abbrechen")}</button>}</div>
          {suggestion && <div className="studio-suggestion"><span className="studio-eyebrow">{tr("VORSCHLAG VON")} {suggestion.provider.toUpperCase()}</span><h3>{suggestion.title}</h3><p>{suggestion.intent}</p><ol>{suggestion.steps.map((s, i) => <li key={i}><strong>{s.title}</strong><p>{s.detail}</p>{s.why && <p>{tr("Warum:")} {s.why}</p>}{s.exceptions && <p>{tr("Ausnahmen / Fragen:")} {s.exceptions}</p>}</li>)}</ol><button className="studio-secondary" onClick={() => { setUndo(structuredClone(document)); edit(applySuggestion(document, suggestion)); setSelected(0); }}>{tr("Vorschlag in Editor übernehmen")}</button><button onClick={() => setSuggestion(null)}>{tr("Verwerfen")}</button></div>}
        </div></details>
        <footer className="studio-footer"><ActionMenu label={tr('Prozessaktionen')} disabled={!!busy}>
          <button disabled={!!busy} onClick={()=>setShowReview(true)}>{tr("Prozess bewerten")}</button>
          <button disabled={!!busy} onClick={()=>setKnowledge('interview')}>{tr('Wissensinterview')}</button>
          <button disabled={!!busy} onClick={()=>setKnowledge('skill')}>{tr('Skill erstellen')}</button>
          <button disabled={!!busy} onClick={()=>setShowWiki(true)}>{tr("Im Wiki ablegen")}</button>
          <button onClick={() => setShowTranscript(!showTranscript)}>{showTranscript ? tr("Transkript schließen") : tr("Originaltranskript ansehen")}</button>
          <button className="action-menu-danger" disabled={!!busy} onClick={deleteRecording}>{tr("Aufnahme löschen")}</button>
        </ActionMenu><button disabled={!!busy} onClick={() => setShowExport(true)}><Icon name="download"/>{tr('Anleitung exportieren')}</button></footer></section>
        {showTranscript && <section className="studio-transcript"><h2>{tr("Originaltranskript")}</h2><p>{document.transcript || tr("Noch kein Transkript vorhanden. Sprache kann nach einer Aufnahme lokal transkribiert werden.")}</p><button disabled={!!busy} onClick={async () => { setBusy(tr("Lokal transkribieren")); try { const r = await window.skillRecorder.transcribeNarration(document.sessionId); if (!r.ok) throw new Error(r.error); if (dirty) { setNotice(tr("Transkript erstellt. Änderungen speichern und Sitzung neu laden, um es einzulesen.")); } else await open(document.sessionId); } catch (e) { setError(message(e)); } finally { setBusy(''); } }}>{tr("Sprache lokal transkribieren")}</button></section>}
      </> : <div className="studio-welcome"><Icon name="flow"/><h2>{tr("Zeig, wie du arbeitest.")}</h2><p>{tr("Öffne eine eigene Aufnahme aus der Seitenleiste oder lege einen leeren Prozess an.")}</p><button className="studio-primary" onClick={() => void createDocument()} disabled={!!busy}>{tr("Neuen Prozess anlegen")}</button><small>{tr("Ein neuer Prozess startet leer. Aufnahme und KI-Analyse startest du selbst.")}</small></div>}
    </main>
    {deletion&&<DeleteDialog {...deletion} onClose={()=>setDeletion(null)}/>}
    {showClose && <CloseEditorDialog dirty={dirty} busy={busy} error={error} onCancel={() => { setShowClose(false); void window.skillRecorder.cancelClose(); }} onClose={async keep => {
      if (busy) return;
      if (keep && dirty && !await save()) return;
      allowClose.current = true;
      await window.skillRecorder.closeLibrary();
    }}/>}
    {screenToGif&&<ScreenToGifDialog document={document} stepId={current?.id} materialId={screenToGif.materialId} onClose={()=>setScreenToGif(null)} onImport={(id,material,mainImage)=>{if(!document)return;const step=document.steps.find(s=>s.id===id);if(!step)return;setUndo(structuredClone(document));edit({...document,steps:document.steps.map(s=>s.id===id?{...s,materials:[...(s.materials??[]),material],...(mainImage?{image:material,imagePointer:undefined}:{})}:s)});setScreenToGif(null);setNotice(tr('ScreenToGif-Ergebnis hinzugefügt. Prozess speichern.'));}}/>}
    {showWiki && document && <WikiPublish document={document} onClose={()=>setShowWiki(false)} onActivity={active=>setBusy(active ? tr("Im Wiki ablegen") : "")}/>}
    {showReview && document && <ProcessReview document={document} settings={settings} onClose={()=>setShowReview(false)} onChange={change=>edit({...document,...change})} onActivity={active=>setBusy(active ? tr("Prozess bewerten") : "")}/>}
    {showSettings && <ProviderSettings settings={settings} onClose={() => setShowSettings(false)} onSave={next => { setSettings(next); setConsent(false); setNotice(tr("KI-Anbieter lokal gespeichert")); }}/>}
    {expandedImage && image && current && <FramePreview image={image} title={current.title} onClose={() => setExpandedImage(false)}/>}
    {showImageEditor&&image&&current&&document&&<StepImageEditor sessionId={document.sessionId} source={current.image?{materialId:current.image.id}:{stepId:stepEvidence(current).find(e=>e.frame===current.frame)?.id??current.id}} image={image} pointer={current.image?current.imagePointer:current.pointer} onClose={()=>setShowImageEditor(false)} onApply={result=>{setUndo(structuredClone(document));editStep({image:result.image,imagePointer:result.pointer,materials:current.materials?.filter(m=>m.id!==current.image?.id)});setShowImageEditor(false);}}/>}
    {knowledge&&document&&<WorkflowKnowledge document={document} profile={profile} kind={knowledge} onClose={()=>setKnowledge(null)} onApply={next=>{setUndo(structuredClone(document));edit(next);setKnowledge(null);}} onExport={file=>{setNotice(tr('Exportiert: {path}',{path:file}));setKnowledge(null);}}/>}
    {showExport && document && <GuideExportDialog document={document} onClose={() => setShowExport(false)} onActivity={active => setBusy(active ? tr('Export wird erstellt …') : '')} onDone={file => { setNotice(tr('Exportiert: {path}', { path: file })); setShowExport(false); }}/>} 
  </div>;
}

function CloseEditorDialog({ dirty, busy, error, onCancel, onClose }: { dirty: boolean; busy: string; error: string; onCancel: () => void; onClose: (keep: boolean) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const close = async (keep: boolean) => { setPending(true); try { await onClose(keep); } finally { setPending(false); } };
  return <dialog ref={dialog} className="studio-modal studio-close-dialog" aria-labelledby="studio-close-title" onCancel={event => { event.preventDefault(); if (!pending) onCancel(); }}>
    <h2 id="studio-close-title">{tr(dirty ? 'Änderungen vor dem Schließen speichern?' : 'Studio schließen?')}</h2>
    <p>{busy ? tr('Ein Vorgang läuft noch. Warte auf den Abschluss oder kehre zum Studio zurück.') : dirty ? tr('Deine letzten Änderungen sind noch nicht gespeichert.') : tr('Der Vorgang ist abgeschlossen. Du kannst das Studio jetzt schließen.')}</p>
    {busy && <p role="status">{busy} …</p>}{error && <p role="alert">{error}</p>}
    <div className="studio-close-actions"><button autoFocus disabled={pending} onClick={onCancel}>{tr('Weiterbearbeiten')}</button>{dirty && <button disabled={!!busy || pending} onClick={() => void close(false)}>{tr('Ohne Speichern schließen')}</button>}<button className="studio-primary" disabled={!!busy || pending} onClick={() => void close(true)}>{tr(dirty ? 'Speichern und schließen' : 'Schließen')}</button></div>
  </dialog>;
}

function FramePreview({ image, title, onClose }: { image: string; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current; node?.showModal();
    return () => node?.close();
  }, []);
  return <dialog ref={dialog} className="studio-preview" aria-labelledby="studio-preview-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="studio-preview-content"><header><h2 id="studio-preview-title">{title || tr('Bildschirmvorschau')}</h2><button autoFocus onClick={onClose}><Icon name="close"/>{tr('Schließen')}</button></header><img src={image} alt={tr('Aufgezeichneter Bildschirm zu {title}', { title })}/></div>
  </dialog>;
}

function ProviderSettings({ settings, onClose, onSave }: { settings: StudioSettings; onClose: () => void; onSave: (settings: StudioSettings) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const [draft, setDraft] = useState(structuredClone(settings));
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false); const [models, setModels] = useState<string[]>([]);
  const [testConsent, setTestConsent] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<StudioSuggestion | null>(null);
  const [localServers, setLocalServers] = useState<LocalProviderResult[] | null>(null);
  const p = draft.profiles.find(profile => profile.id === draft.selected)!;
  const update = (patch: Partial<ProviderProfile>) => { setDraft({ ...draft, profiles: draft.profiles.map(v => v.id === p.id ? { ...v, ...patch } : v) }); if (patch.baseUrl !== undefined) setModels([]); setStatus(''); setTestResult(null); setTestConsent(false); };
  const persist = async () => { const r = await api().saveSettings(draft, keys); if (!r.ok || !r.value) throw new Error(r.error); setDraft(r.value); setKeys({}); onSave(r.value); return r.value; };
  const save = async () => { setError(''); setBusy(true); try { await persist(); onClose(); } catch (e) { setError(message(e)); } finally { setBusy(false); } };
  const check = async () => {
    setBusy(true); setError(''); setStatus(tr("Verbindung wird geprüft …")); setTestResult(null);
    try { const saved = await persist(); const r = await api().check(saved.selected); if (!r.ok || !r.value) throw new Error(r.error); setModels(r.value.models); setStatus(r.value.message); }
    catch (e) { setStatus(''); setError(message(e)); } finally { setBusy(false); }
  };
  const test = async () => {
    if (!testConsent) return;
    setBusy(true); setTesting(true); setError(''); setStatus(tr("Künstlicher Beispielprozess wird analysiert …")); setTestResult(null);
    try { const saved = await persist(); const r = await api().testProvider(saved.selected, true); if (!r.ok || !r.value) throw new Error(r.error); setTestResult(r.value); setStatus(tr('Analyse erfolgreich: {count} Schritte im gültigen Editorformat erhalten.', { count: r.value.steps.length })); }
    catch (e) { setStatus(''); setError(message(e)); } finally { setBusy(false); setTesting(false); setTestConsent(false); }
  };
  const discover = async () => {
    setBusy(true); setError(''); setStatus(tr('Lokale Server werden gesucht …')); setLocalServers(null); setTestResult(null);
    try {
      const r = await api().discoverLocal();
      if (!r.ok || !r.value) throw new Error(r.error);
      setLocalServers(r.value); setStatus('');
    } catch (e) { setStatus(''); setError(message(e)); } finally { setBusy(false); }
  };
  const useLocal = (server: LocalProviderResult) => {
    const current = draft.profiles.find(v => v.id === server.profileId);
    if (!current) { setError(tr('Kein freies Anbieterprofil. Einen vorhandenen Anbieter mit der Basis-URL einrichten.')); return; }
    const changedUrl = current.baseUrl !== server.baseUrl;
    const model = server.models.includes(current.model) ? current.model : server.models.length === 1 ? server.models[0] : '';
    setDraft({ ...draft, selected: current.id, profiles: draft.profiles.map(v => v.id === current.id ? { ...v, baseUrl: server.baseUrl, model, hasKey: changedUrl ? false : v.hasKey } : v) });
    if (changedUrl) setKeys(values => { const next = { ...values }; delete next[current.id]; return next; });
    setModels(server.models); setError(''); setStatus(tr('Server übernommen. Modell prüfen und Einstellungen speichern.')); setTestResult(null); setTestConsent(false);
  };
  return <dialog ref={dialog} className="studio-modal studio-provider-settings" aria-label={tr("KI-Anbieter einrichten")} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><div className="studio-section-head"><div><span className="studio-eyebrow">{tr("DU WÄHLST DAS MODELL")}</span><h2>{tr("KI-Anbieter einrichten")}</h2></div><button onClick={onClose} disabled={busy} aria-label={tr("Einstellungen schließen")}><Icon name="close"/></button></div>
    <details className="studio-provider-discovery">
      <summary>{tr('Vorhandene lokale Modelle verwenden')}<small>Ollama · LM Studio · vLLM</small></summary>
      <div className="studio-discovery-body">
      <p>{tr('Nutze deine vorhandene Ollama-, LM-Studio- oder vLLM-Installation. Starte dort den API-Server. Workflow Studio fragt nur die Modellliste ab; es installiert, kopiert oder lädt keine Modelle herunter.')}</p>
      <button disabled={busy} onClick={() => void discover()}>{tr('Lokale Server suchen')}</button>
      <p className="studio-provider-description">{tr('Suche nur auf diesem Rechner: Ollama 11434, LM Studio 1234, vLLM 8000. Andere Ports und interne Server unten über die Basis-URL einrichten. Die Suche erkennt kompatible Schnittstellen, nicht die installierte Anwendung.')}</p>
      {localServers && <ul className="studio-server-results">{localServers.map(server => <li key={server.profileId}><strong>{tr(server.name)}</strong><span>{server.baseUrl}</span><p>{server.reachable ? server.models.length ? tr('{count} Modelle verfügbar.', { count: server.models.length }) : tr('Server erreicht, aber keine Modellliste verfügbar. Modell oder Zugang manuell prüfen.') : tr(server.message)}</p>{server.models.length > 0 && <button disabled={busy} onClick={() => useLocal(server)}>{tr('{provider} verwenden', { provider: tr(server.name) })}</button>}</li>)}</ul>}
      </div>
    </details>
    <label>{tr("Anbieter")}<select value={draft.selected} disabled={busy} onChange={e => { setDraft({ ...draft, selected: e.target.value }); setModels([]); setError(''); setStatus(''); setTestConsent(false); setTestResult(null); }}>{draft.profiles.map(v => <option key={v.id} value={v.id}>{tr(v.name)}</option>)}</select></label>
    <p className="studio-provider-description">{p.kind === 'ollama' ? tr("Lokale Modelle über Ollama. Der Server muss bereits laufen; es wird kein Modell automatisch heruntergeladen.") : p.kind === 'compatible' ? tr("Für LM Studio, OpenLLM, vLLM, OpenRouter und andere Server mit OpenAI-kompatibler Chat-Completions-Schnittstelle.") : p.kind === 'codex' ? tr("Verwendet deine separat installierte Codex-CLI und deren bestehende Anmeldung. Start im read-only-Modus; keine Anmeldung wird automatisch eingerichtet.") : p.kind === 'claude' ? tr("Direkte Anthropic Messages API mit eigenem API-Schlüssel. Ein Claude-Chat-Abonnement ist kein API-Schlüssel.") : tr("Der vorhandene Copilot-Analyseweg bleibt verfügbar. Anmeldung und Skill-Erstellung verwenden weiterhin die bestehenden Recorder-Funktionen.")}</p>
    {p.id === 'zai' && <p className="studio-provider-description">{tr("Z.ai ist für die allgemeine API vorkonfiguriert. Eigenen Z.ai-API-Schlüssel und freigeschalteten GLM-Modellnamen eintragen. Ein Coding-Plan gilt nicht automatisch für diese allgemeine Prozessanalyse.")}</p>}
    {p.id === 'lmstudio' && <p className="studio-provider-description">{tr("In LM Studio ein Modell laden und den lokalen Server starten. Danach hier die Verbindung prüfen und das geladene Modell auswählen.")}</p>}
    {p.id === 'vllm' && <p className="studio-provider-description">{tr('Vorhandenen vLLM-Server mit einem Chatmodell verwenden. Die Modellliste zeigt die vom Server bereitgestellten Modelle. Für einen internen Server die freigegebene HTTPS-Basis-URL inklusive /v1 eintragen.')}</p>}
    {p.kind !== 'copilot' && <>
      {p.kind !== 'codex' && <label>{tr("Basis-URL")}<input aria-label={tr("Anbieter Basis-URL")} value={p.baseUrl} onChange={e => update({ baseUrl: e.target.value })} disabled={busy}/><small>{tr("API-Basis ohne /chat/completions oder /messages; bei LM Studio inklusive /v1. HTTP nur für localhost; extern HTTPS.")}</small></label>}
      {p.kind === 'codex' && <label>{tr("Pfad zur Codex-CLI")}<input aria-label={tr("Codex CLI Pfad")} value={p.cliPath} onChange={e => update({ cliPath: e.target.value })} placeholder={tr("codex.exe über PATH oder vollständiger Pfad")} disabled={busy}/></label>}
      <label>{tr("Modell")}<input aria-label={tr("Modellname")} list="studio-models" value={p.model} onChange={e => update({ model: e.target.value })} placeholder={p.kind === 'codex' ? tr("Leer = CLI-Standardmodell") : tr("Exakter Modellname deines Anbieters")} disabled={busy}/><datalist id="studio-models">{models.map(model => <option key={model} value={model}/>)}</datalist></label>
      {models.length > 0 && <label>{tr("Gefundene Modelle")}<select aria-label={tr("Gefundenes Modell auswählen")} value={models.includes(p.model) ? p.model : ''} disabled={busy} onChange={e => update({ model: e.target.value })}><option value="" disabled>{tr("Ein Modell auswählen")}</option>{models.map(model => <option key={model} value={model}>{model}</option>)}</select></label>}
      <details key={p.id} className="studio-provider-advanced" open={!['ollama', 'lmstudio', 'vllm'].includes(p.id)}><summary>{tr('Zugang und Bildanalyse')}</summary>
      {p.kind !== 'codex' && <label>{tr("API-Schlüssel")} {p.hasKey && <span className="studio-key-saved">{tr("· gespeichert")}</span>}<input aria-label={tr("API-Schlüssel")} type="password" value={keys[p.id] ?? ''} autoComplete="off" onChange={e => { setKeys({ ...keys, [p.id]: e.target.value }); setStatus(''); setTestResult(null); setTestConsent(false); }} placeholder={p.hasKey ? tr("Leer lassen, um gespeicherten Schlüssel zu behalten") : tr("Bei lokalen Servern meist nicht erforderlich")} disabled={busy}/><small>{tr("Schlüssel werden durch den Betriebssystem-Schlüsselschutz verschlüsselt gespeichert. Bei Wechsel der Ziel-URL muss der Schlüssel erneut hinterlegt werden.")}</small></label>}
      <label className="studio-consent"><input type="checkbox" checked={!!p.vision} disabled={busy} onChange={e=>update({vision:e.target.checked})}/><span>{tr('Dieses Modell kann Bilder auswerten.')}<small>{tr('Nur aktivieren, wenn der gewählte Modellname und Server Bildkontext unterstützen. Jede Bildübermittlung wird zusätzlich bestätigt.')}</small></span></label>
      </details>
        <button disabled={busy} onClick={() => void check()}><Icon name="check"/> {tr("Speichern & Verbindung prüfen")}</button>
      <details className="studio-provider-test" aria-label={tr("Anbieter mit Beispieldaten testen")}><summary>{tr("Mit Beispieldaten testen")}</summary><div className="studio-provider-test-body"><p>{tr("Prüft den vollständigen Weg bis zum gültigen Schrittvorschlag. Der Test sendet nur einen fest eingebauten, künstlichen Prozess. Dein geöffnetes Dokument wird weder versendet noch verändert.")}</p><label className="studio-consent"><input type="checkbox" checked={testConsent} disabled={busy} onChange={e => setTestConsent(e.target.checked)}/><span>{tr('Künstliche Testdaten an {provider} senden.', { provider: tr(p.name) })}<small>{tr("Bei Cloud-Anbietern kann der Test Kosten oder Kontingent verbrauchen. Codex verwendet die bestehende CLI-Konfiguration.")}</small></span></label><div className="studio-ai-actions"><button className="studio-secondary" disabled={busy || !testConsent || (p.kind !== 'codex' && !p.model.trim())} onClick={() => void test()}><Icon name="sparkle"/> {tr("Speichern & Beispiel analysieren")}</button>{testing && <button onClick={() => void api().cancel()}>{tr("Test abbrechen")}</button>}</div>{p.kind !== 'codex' && !p.model.trim() && <p>{tr("Vor dem Analysetest einen Modellnamen wählen oder eintragen.")}</p>}</div></details>
    </>}
    {error && <div className="studio-error" role="alert">{error}</div>}{status && <p role="status">{status}</p>}
    {testResult && <details className="studio-test-result" open><summary>{tr("Erhaltener Testvorschlag")}</summary><strong>{testResult.title}</strong><p>{testResult.intent}</p><ol>{testResult.steps.map((step, index) => <li key={index}><strong>{step.title}</strong><p>{step.detail}</p>{step.why && <p>{tr("Warum:")} {step.why}</p>}{step.exceptions && <p>{tr("Ausnahmen:")} {step.exceptions}</p>}</li>)}</ol></details>}
    <div className="studio-modal-actions"><button onClick={onClose} disabled={busy}>{tr("Schließen")}</button><button className="studio-primary" onClick={() => void save()} disabled={busy}>{tr("Einstellungen speichern")}</button></div>
  </dialog>;
}
