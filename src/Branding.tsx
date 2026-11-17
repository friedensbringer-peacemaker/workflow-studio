import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { BrandingSchema, BRANDING_PRESETS, DEFAULT_BRANDING, brandTitle, brandTokens, foreground } from '../common/branding';
import { tr } from './i18n';

const Context = createContext(DEFAULT_BRANDING);
export function BrandingSync({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState(DEFAULT_BRANDING);
  useEffect(() => {
    let active = true, changed = false;
    const off = window.skillRecorder.studio.onBrandingChanged(next => { changed = true; setBrand(next); });
    void window.skillRecorder.studio.branding().then(r => { if (active && !changed && r.ok && r.value) setBrand(r.value); }).catch(() => {});
    return () => { active = false; off(); };
  }, []);
  useEffect(() => {
    for (const [key, value] of Object.entries(brandTokens(brand))) document.documentElement.style.setProperty(key, value);
    const route = document.body.dataset.route;
    if (route === 'library' || route === 'recorder') document.title = brandTitle(brand, route === 'library' ? 'Workflow Studio' : 'Workflow Recorder');
  }, [brand]);
  return <Context.Provider value={brand}>{children}</Context.Provider>;
}
export function BrandMark({ className = '' }: { className?: string }) {
  const brand = useContext(Context);
  if (!brand.logo) return null;
  return <div className={`brand-mark ${className}`}><img src={brand.logo} alt={brand.companyName || tr('Firmenlogo')}/></div>;
}
export function BrandingForm({ onSaved, onBusy }: { onSaved: () => void; onBusy: (busy: boolean) => void }) {
  const brand = useContext(Context); const [draft, setDraft] = useState({ ...brand });
  const preset = Object.entries(BRANDING_PRESETS).find(([, colors]) => colors.primary.toLowerCase() === draft.primary.toLowerCase() && colors.secondary.toLowerCase() === draft.secondary.toLowerCase())?.[0] ?? 'custom';
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const pending = (value: boolean) => { setBusy(value); onBusy(value); };
  return <form className="branding-form" onSubmit={async e => {
    e.preventDefault(); pending(true); setError('');
    try { const result = await window.skillRecorder.studio.saveBranding(BrandingSchema.parse(draft)); if (!result.ok) throw new Error(result.error); onSaved(); }
    catch (e) { const detail=e instanceof Error?e.message:String(e);setError(/No handler|saveBranding.*function/i.test(detail)?tr('Die Programmversion im Hintergrund ist veraltet. Prozess speichern und Workflow Studio vollständig neu starten.'):tr('Gestaltung konnte nicht gespeichert werden.')+' '+detail); } finally { pending(false); }
  }}>
    <p>{tr('Für Recorder, Studio und neue HTML-Anleitungen. Lokal auf diesem Rechner gespeichert.')}</p>
    <label>{tr('Farbvorlage')}<select aria-label={tr('Farbvorlage')} value={preset} disabled={busy} onChange={e => {
      const colors = BRANDING_PRESETS[e.target.value as keyof typeof BRANDING_PRESETS];
      if (colors) setDraft(old => ({ ...old, ...colors }));
    }}><option value="green">{tr('Hellgrün')}</option><option value="yellow">{tr('Gelb')}</option><option value="custom" disabled>{tr('Eigene Farben')}</option></select></label>
    <label>{tr('Firmenname')}<input maxLength={80} value={draft.companyName} disabled={busy} onChange={e => setDraft({ ...draft, companyName: e.target.value })} placeholder={tr('Leer lassen für Workflow Studio')}/></label>
    <label>{tr('Firmenlogo')}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      pending(true); setError('');
      try {
        if (file.size > 2_000_000) throw new Error();
        const result = await window.skillRecorder.studio.prepareLogo(new Uint8Array(await file.arrayBuffer()));
        if (!result.ok || !result.value) throw new Error(); setDraft(old => ({ ...old, logo: result.value! }));
      } catch { setError(tr('Logo: PNG, JPEG oder WebP bis 2 MB auswählen.')); } finally { pending(false); }
    }}/></label>
    {draft.logo && <button type="button" disabled={busy} onClick={() => setDraft({ ...draft, logo: '' })}>{tr('Logo entfernen')}</button>}
    <div className="branding-colors">{(['primary', 'secondary'] as const).map(key => <label key={key}>{tr(key === 'primary' ? 'Akzentfarbe' : 'Zweite Farbe')}
      <input aria-label={tr(key === 'primary' ? 'Akzentfarbe' : 'Zweite Farbe')} type="color" value={draft[key]} disabled={busy} onChange={e => setDraft({ ...draft, [key]: e.target.value })}/><span>{draft[key].toUpperCase()}</span>
    </label>)}</div>
    <div className="branding-preview" style={brandTokens(draft) as CSSProperties} aria-label={tr('Vorschau')}>
      {draft.logo && <img src={draft.logo} alt={tr('Firmenlogo')}/>}<strong style={{ color: draft.secondary }}>{brandTitle(draft)}</strong>
      <div><span style={{ background: draft.primary, color: foreground(draft.primary) }}>{tr('Hauptaktion')}</span><span style={{ background: draft.secondary, color: foreground(draft.secondary) }}>{tr('Zweite Aktion')}</span></div>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="settings-actions"><button type="button" disabled={busy} onClick={() => setDraft({ ...DEFAULT_BRANDING })}>{tr('Standard wiederherstellen')}</button><button type="submit" disabled={busy}>{tr('Speichern')}</button></div>
  </form>;
}
