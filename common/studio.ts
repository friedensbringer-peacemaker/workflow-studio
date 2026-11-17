import { z } from 'zod';
import { ReviewMethodSchema, SavedReviewSchema, reviewMarkdown, reviewSnapshot } from './process-review';
import type { SessionBundle } from './bundle';
import { MaterialSchema, type StepMaterial } from './step-material';
import { InterviewQuestionSchema } from './interview';
import { StepNarrationSchema, narrationText } from './studio-narration';
const PointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const EvidenceSchema = z.object({ id: z.string().min(1).max(128), frame: z.string().max(500).optional(), pointer: PointSchema.optional() });

export const StudioStepSchema = z.object({
  id: z.string().min(1).max(128), title: z.string().max(500), detail: z.string().max(12000),
  why: z.string().max(6000).default(''), exceptions: z.string().max(6000).default(''),
  app: z.string().max(500).default(''), frame: z.string().max(500).optional(),
  startMs: z.number().optional(), source: z.enum(['capture', 'manual', 'ai']).default('manual'),
  endMs:z.number().optional(), narration:z.array(StepNarrationSchema).max(2000).optional(),
  pointer: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  supplement: z.string().max(12000).optional(),
  materials: z.array(MaterialSchema).max(20).optional(),
  image: MaterialSchema.optional(), imagePointer: PointSchema.optional(),
  evidence: z.array(EvidenceSchema).max(1000).optional(),
});
export type StudioStep = z.infer<typeof StudioStepSchema>;
export const StudioDocumentSchema = z.object({
  version: z.literal(1), sessionId: z.string().min(1).max(128), title: z.string().max(500),
  intent: z.string().max(6000), steps: z.array(StudioStepSchema).max(1000),
  transcript: z.string().max(60000).default(''), updatedAt: z.number(),
  interview:z.array(InterviewQuestionSchema).max(100).optional(),
  reviewMethod: ReviewMethodSchema.optional(), processReview: SavedReviewSchema.optional(),
  narrationImports:z.array(z.string().max(100)).max(2000).optional(),
});
export type StudioDocument = z.infer<typeof StudioDocumentSchema>;
export const ProviderKind = z.enum(['ollama', 'compatible', 'claude', 'codex', 'copilot']);
export type ProviderKind = z.infer<typeof ProviderKind>;
export const ProviderProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,64}$/), name: z.string().min(1).max(100), kind: ProviderKind,
  baseUrl: z.string().max(2000), model: z.string().max(200), cliPath: z.string().max(1000).default(''),
  hasKey: z.boolean().default(false),
  vision: z.boolean().optional(),
});
export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;
export const StudioSettingsSchema = z.object({
  selected: z.string(), profiles: z.array(ProviderProfileSchema).min(1).max(20),
}).refine(v => new Set(v.profiles.map(p => p.id)).size === v.profiles.length && v.profiles.some(p => p.id === v.selected), 'Invalid or duplicate provider selection');
export type StudioSettings = z.infer<typeof StudioSettingsSchema>;
export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  selected: 'ollama', profiles: [
    { id: 'ollama', name: 'Ollama · lokal', kind: 'ollama', baseUrl: 'http://localhost:11434', model: '', cliPath: '', hasKey: false },
    { id: 'compatible', name: 'OpenAI-kompatibel · frei', kind: 'compatible', baseUrl: 'http://localhost:1234/v1', model: '', cliPath: '', hasKey: false },
    { id: 'lmstudio', name: 'LM Studio · lokal', kind: 'compatible', baseUrl: 'http://localhost:1234/v1', model: '', cliPath: '', hasKey: false },
    { id: 'vllm', name: 'vLLM · lokal', kind: 'compatible', baseUrl: 'http://localhost:8000/v1', model: '', cliPath: '', hasKey: false },
    { id: 'zai', name: 'Z.ai · API', kind: 'compatible', baseUrl: 'https://api.z.ai/api/paas/v4', model: '', cliPath: '', hasKey: false },
    { id: 'claude', name: 'Claude · API', kind: 'claude', baseUrl: 'https://api.anthropic.com/v1', model: '', cliPath: '', hasKey: false },
    { id: 'codex', name: 'Codex · CLI', kind: 'codex', baseUrl: '', model: '', cliPath: '', hasKey: false },
    { id: 'copilot', name: 'GitHub Copilot · bestehend', kind: 'copilot', baseUrl: '', model: '', cliPath: '', hasKey: false },
  ],
};

/** Add new presets without replacing the user's model, endpoint, key status or selection. */
export function completeStudioSettings(settings: StudioSettings): StudioSettings {
  return StudioSettingsSchema.parse({ ...settings, profiles: [...settings.profiles,
    ...DEFAULT_STUDIO_SETTINGS.profiles.filter(p => !settings.profiles.some(old => old.id === p.id)).slice(0, 20 - settings.profiles.length).map(p => ({ ...p }))] });
}

export const PROVIDER_TEST_DOCUMENT: StudioDocument = {
  version: 1, sessionId: 'synthetic-provider-test', title: 'Künstlicher Verbindungstest', intent: 'Eine erfundene Anfrage prüfen.',
  transcript: 'Künstliche Testdaten. Vor dem Entwurf prüfen wir, ob alle Angaben vollständig sind.', updatedAt: 0,
  steps: [{ id: 'test-1', title: 'Angaben prüfen', detail: 'Die erfundene Anfrage auf Vollständigkeit prüfen.',
    why: 'Rückfragen vor dem Entwurf klären.', exceptions: 'Bei fehlenden Angaben nachfragen.', app: 'Testanwendung', source: 'manual' }],
};

export interface ProviderCheck { message: string; models: string[] }
export interface LocalProviderResult {
  profileId: string; name: string; baseUrl: string; models: string[]; reachable: boolean; message: string;
}

export interface StudioSuggestion { title: string; intent: string; steps: StudioStep[]; provider: string }
export interface StudioResult<T> { ok: boolean; value?: T; error?: string }
export interface StudioApi {
  dictate(consent: boolean): Promise<StudioResult<void>>;
  deletionStatus(): Promise<StudioResult<{enabled:boolean}>>;
  configureDeletion(current: string, next: string): Promise<StudioResult<{enabled:boolean}>>;
  deleteMaterial(document: StudioDocument, id: string, password: string): Promise<StudioResult<StudioDocument>>;
  narrationSource(id:string):Promise<StudioResult<import('./studio-narration').NarrationSource|null>>;
  wikiTargets(): Promise<StudioResult<import('./wiki').WikiTarget[]>>;
  saveWikiTarget(target: import('./wiki').WikiTarget, key: string): Promise<StudioResult<import('./wiki').WikiTarget>>;
  wikiFolder(): Promise<StudioResult<string>>;
  publishWiki(document: StudioDocument, kind: import('./wiki').WikiTarget['kind'], includeReview: boolean, confirmed: boolean): Promise<StudioResult<string>>;
  reviewProcess(document: StudioDocument, profileId: string, method: import('./process-review').ReviewMethod, consent: boolean): Promise<StudioResult<import('./process-review').SavedReview>>;
  branding(): Promise<StudioResult<import('./branding').Branding>>;
  saveBranding(brand: import('./branding').Branding): Promise<StudioResult<import('./branding').Branding>>;
  prepareLogo(bytes: Uint8Array): Promise<StudioResult<string>>;
  onBrandingChanged(callback: (brand: import('./branding').Branding) => void): () => void;
  windowMode(): Promise<StudioResult<import('./window-layout').StudioWindowMode>>;
  setWindowMode(mode: import('./window-layout').StudioWindowMode): Promise<StudioResult<import('./window-layout').StudioWindowMode>>;
  onWindowModeChanged(callback: (mode: import('./window-layout').StudioWindowMode) => void): () => void;
  screenToGifStatus():Promise<StudioResult<import('./screentogif').ScreenToGifStatus>>;
  screenToGifInfo(page:'release'|'license'):Promise<StudioResult<void>>;
  screenToGifSelect():Promise<StudioResult<import('./screentogif').ScreenToGifStatus>>;
  screenToGifDownload(consent:boolean):Promise<StudioResult<import('./screentogif').ScreenToGifStatus>>;
  screenToGifCancelDownload():Promise<StudioResult<void>>;
  screenToGifOpen(document:StudioDocument,request:import('./screentogif').ScreenToGifRequest):Promise<StudioResult<import('./screentogif').ScreenToGifJob>>;
  screenToGifJob(sessionId:string,id:string):Promise<StudioResult<import('./screentogif').ScreenToGifJob>>;
  screenToGifJobs(sessionId:string,stepId:string):Promise<StudioResult<import('./screentogif').ScreenToGifJob[]>>;
  screenToGifFolder(sessionId:string,id:string):Promise<StudioResult<void>>;
  screenToGifImport(sessionId:string,id:string,name?:string):Promise<StudioResult<StepMaterial|null>>;
  knowledge(document:StudioDocument,profileId:string,kind:'interview'|'skill',consent:boolean,language?:'de'|'en'):Promise<StudioResult<{questions?:import('./workflow-knowledge').InterviewQuestion[];skill?:string}>>;
  exportSkill(document:StudioDocument,body:string,reviewed:boolean):Promise<StudioResult<string>>;
  editImage(sessionId: string, source: { stepId?: string; materialId?: string }, recipe: import('./image-edit').ImageEdit): Promise<StudioResult<import('./image-edit').ImageEditResult>>;
  exportGuide(document: StudioDocument, options: import('./guide-export').GuideExportOptions): Promise<StudioResult<string>>;
  openRegionPicker(sourceId: string): Promise<StudioResult<void>>;
  targetPreview(sourceId: string): Promise<StudioResult<string>>;
  setCaptureRegion(sourceId: string, region: import('./capture-region').CaptureRegion | null): Promise<StudioResult<import('./ipc').ScreenSettingsStatus>>;
  importMaterials(sessionId: string, remaining: number): Promise<StudioResult<StepMaterial[]>>;
  saveVoice(sessionId: string, bytes: Uint8Array): Promise<StudioResult<StepMaterial>>;
  material(sessionId: string, id: string): Promise<StudioResult<string>>;
  openMaterial(sessionId: string, id: string): Promise<StudioResult<void>>;
  transcribeMaterial(sessionId: string, id: string, language: 'de' | 'en'): Promise<StudioResult<string>>;
  inputSettings(): Promise<StudioResult<import('./input-capture').InputCaptureSettings>>;
  saveInputSettings(settings: import('./input-capture').InputCaptureSettings): Promise<StudioResult<import('./input-capture').InputCaptureSettings>>;
  onInputSettingsChanged(callback: (settings: import('./input-capture').InputCaptureSettings) => void): () => void;
  uiLanguage(): Promise<StudioResult<import('./ui-language').UiLanguage>>;
  setUiLanguage(language: import('./ui-language').UiLanguage): Promise<StudioResult<import('./ui-language').UiLanguage>>;
  onLanguageChanged(callback: (language: import('./ui-language').UiLanguage) => void): () => void;
  onSettingsChanged(callback: (settings: StudioSettings) => void): () => void;
  load(sessionId: string): Promise<StudioResult<StudioDocument>>;
  save(document: StudioDocument, password?:string): Promise<StudioResult<StudioDocument>>;
  frame(sessionId: string, file: string): Promise<StudioResult<string>>;
  settings(): Promise<StudioResult<StudioSettings>>;
  saveSettings(settings: StudioSettings, keys: Record<string, string>): Promise<StudioResult<StudioSettings>>;
  models(profileId: string): Promise<StudioResult<string[]>>;
  check(profileId: string): Promise<StudioResult<ProviderCheck>>;
  discoverLocal(): Promise<StudioResult<LocalProviderResult[]>>;
  testProvider(profileId: string, consent: boolean): Promise<StudioResult<StudioSuggestion>>;
  analyze(document: StudioDocument, profileId: string, consent: boolean, images?:boolean): Promise<StudioResult<StudioSuggestion>>;
  cancel(): Promise<void>;
  export(document: StudioDocument, format: 'markdown' | 'json' | 'svg' | 'drawio' | 'mermaid'): Promise<StudioResult<string>>;
  createDocument(): Promise<StudioResult<string>>;
}

export function documentFromBundle(bundle: SessionBundle): StudioDocument {
  return {
    version: 1, sessionId: bundle.session.id, title: 'Neue Prozessaufnahme', intent: '', transcript: '', updatedAt: Date.now(),
    steps: bundle.steps.slice(0, 1000).map(s => ({ id: `capture-${s.index}`, title: s.summary || `Schritt ${s.index + 1}`,
      detail: [...s.titles, ...s.markers].join('\n'), why: '', exceptions: '', app: s.app ?? '',
      frame: s.frames[0], pointer: s.pointer, startMs: s.startMs, endMs:s.endMs, source: 'capture' })),
  };
}

/** Model output never gets to introduce filesystem paths or overwrite evidence. */
export function applySuggestion(document: StudioDocument, suggestion: StudioSuggestion): StudioDocument {
  const ids = new Set<string>();
  return StudioDocumentSchema.parse({ ...document, title: suggestion.title, intent: suggestion.intent,
    steps: suggestion.steps.map<StudioStep>((s, i) => {
      const original = document.steps.find(old => old.id === s.id);
      const id = !ids.has(s.id) ? s.id : `ai-${i}-${Date.now()}`;
      ids.add(id);
      return { ...s, id, frame: original?.frame, pointer: original?.pointer, image: original?.image, imagePointer: original?.imagePointer, evidence: original?.evidence, materials: original?.materials, supplement: original?.supplement, narration:original?.narration, startMs: original?.startMs, endMs:original?.endMs, app: original?.app ?? s.app, source: 'ai' };
    }).concat(document.steps.filter(s => !suggestion.steps.some(next => next.id === s.id) && (s.image || s.supplement || s.narration?.length || s.materials?.length || document.interview?.some(q => q.stepId === s.id)))),
  });
}

export function documentMarkdown(document: StudioDocument, language:'de'|'en'='de'): string {
  const label = (de:string,en:string) => language==='de'?de:en;
  const heading = (text: string) => text.replace(/[\r\n]+/g, ' ').trim();
  return `# ${heading(document.title)}\n\n${document.intent}\n\n` + document.steps.map((s, i) =>
    `## ${i + 1}. ${heading(s.title)}\n\n${s.detail}\n\n${narrationText(s) ? `**${label('Erklärungen aus der Aufnahme:','Explanations from the recording:')}**\n\n${narrationText(s)}\n\n` : ''}${s.why ? `**${label('Warum:','Why:')}** ${s.why}\n\n` : ''}${s.exceptions ? `**${label('Ausnahmen:','Exceptions:')}** ${s.exceptions}\n\n` : ''}${s.supplement ? `**${label('Ergänzende Informationen:','Additional information:')}**\n\n${s.supplement}\n\n` : ''}${s.materials?.length ? `**${label('Zusatzmaterial (lokal, Dateien separat weitergeben):','Supporting material (local, share files separately):')}**\n\n${s.materials.map(m => `- ${heading(m.name)}`).join('\n')}\n\n` : ''}`
  ).join('') + (document.transcript ? `## ${label('Originaltranskript','Original transcript')}\n\n${document.transcript}\n` : '') + (document.processReview ? (document.processReview.snapshot !== reviewSnapshot(document) ? '\n\nHinweis: Prozess seit der Bewertung geändert.\n' : '') + reviewMarkdown(document.processReview) : '');
}

