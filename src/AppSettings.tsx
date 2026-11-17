import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DeletionSettings } from './DeleteDialog';
import { BrandingForm } from './Branding';
import { LanguageSwitch, tr, useUiLanguage } from './i18n';
import { WindowModeControl } from './WindowModeControl';
import { StudioIcon } from './StudioIcon';
import { InputCaptureOptions } from './InputCaptureOptions';

export function AppSettings({ disabled = false, onProvider, tools }: { disabled?: boolean; onProvider?: () => void; tools?: ReactNode }) {
  useUiLanguage();
  const [open, setOpen] = useState(false);
  return <><button className="app-settings-button" disabled={disabled} onClick={() => setOpen(true)}><StudioIcon name="gear"/>{tr('Einstellungen')}</button>
    {open && <SettingsDialog onClose={() => setOpen(false)} onProvider={onProvider} tools={tools}/>}</>;
}
function SettingsDialog({ onClose, onProvider, tools }: { onClose: () => void; onProvider?: () => void; tools?: ReactNode }) {
  const [tab, setTab] = useState('general'); const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="app-settings" aria-label={tr('Einstellungen')} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header><h2>{tr('Einstellungen')}</h2><button disabled={busy} onClick={onClose} aria-label={tr('Einstellungen schließen')}><StudioIcon name="close"/></button></header>
    <nav aria-label={tr('Einstellungsbereiche')}>{[['general','Allgemein'],['brand','Firma & Gestaltung'],['deletion','Löschschutz'],['tools','Werkzeuge']].map(([id,label]) => <button key={id} disabled={busy} aria-pressed={tab === id} onClick={() => setTab(id)}>{tr(label)}</button>)}</nav>
    <div hidden={tab !== 'general'}><WindowModeControl disabled={busy}/><InputCaptureOptions disabled={busy}/><label className="settings-language">{tr('Sprache der Oberfläche')}<LanguageSwitch/></label>{onProvider && <button onClick={() => { onClose(); onProvider(); }}>{tr('KI-Anbieter einrichten')}</button>}</div>
    <div hidden={tab !== 'deletion'}><DeletionSettings onBusy={setBusy}/></div>
    <div hidden={tab !== 'brand'}><BrandingForm onSaved={onClose} onBusy={setBusy}/></div>
    <div hidden={tab !== 'tools'} onClick={e => { if ((e.target as HTMLElement).closest('button[data-close-settings]')) onClose(); }}>{tools}</div>
  </dialog>;
}
