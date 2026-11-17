import { StudioDocumentSchema, type StudioDocument, type StudioStep } from './studio';
export const stepEvidence = (step: StudioStep) => step.evidence?.length ? step.evidence : step.frame ? [{ id: step.id, frame: step.frame, pointer: step.pointer }] : [];
export function normalizeEvidence(document: StudioDocument, original: StudioDocument): StudioDocument {
  const trusted = new Map(original.steps.flatMap(s => stepEvidence(s)).map(e => [e.id, e]));
  for (const s of original.steps) if (s.frame && !trusted.has(s.id)) trusted.set(s.id, { id: s.id, frame: s.frame, pointer: s.pointer });
  return { ...document, steps: document.steps.map(step => {
    const old = original.steps.find(s => s.id === step.id);
    const requested = step.evidence?.length ? step.evidence : old ? stepEvidence(old) : [];
    const evidence = requested.map(e => {
      const known = trusted.get(e.id); if (!known) throw new Error('Unbekannte Bildquelle. Sitzung neu laden.'); return known;
    });
    const selected = evidence.find(e => e.frame === step.frame) ?? evidence[0];
    return { ...step, evidence, frame: selected?.frame, pointer: selected?.pointer };
  }) };
}
const join = (a?: string, b?: string) => [a,b].filter(Boolean).join('\n\n');
export function mergeSteps(document: StudioDocument, index: number): StudioDocument {
  const a = document.steps[index], b = document.steps[index+1];
  if (!a || !b) throw new Error('Zum Zusammenführen zwei aufeinanderfolgende Schritte wählen.');
  const materials = [...(a.materials ?? []), ...(b.materials ?? []), ...(a.image && b.image && a.image.id !== b.image.id ? [b.image] : [])];
  const merged: StudioStep = { ...a, title: a.title || b.title, detail: join(a.detail,b.detail), why: join(a.why,b.why), exceptions: join(a.exceptions,b.exceptions), supplement: join(a.supplement,b.supplement),
    narration:[...(a.narration??[]),...(b.narration??[])],endMs:Math.max(a.endMs??a.startMs??0,b.endMs??b.startMs??0)||undefined,
    image: a.image ?? b.image, imagePointer: a.image ? a.imagePointer : b.imagePointer,
    materials: [...new Map(materials.map(m=>[m.id,m])).values()], evidence: [...new Map([...stepEvidence(a),...stepEvidence(b)].map(e=>[e.id,e])).values()] };
  return StudioDocumentSchema.parse({ ...document, interview:document.interview?.map(q=>q.stepId===b.id?{...q,stepId:a.id}:q), steps: [...document.steps.slice(0,index), merged, ...document.steps.slice(index+2)] });
}
export function splitStep(document: StudioDocument, index: number, id: string, offset: number): StudioDocument {
  const step = document.steps[index]; if (!step) throw new Error('Kein Schritt ausgewählt.');
  const at = Math.max(0,Math.min(step.detail.length, offset));
  const evidence = stepEvidence(step);
  const first = { ...step, detail: step.detail.slice(0,at).trim(), evidence };
  const second = { ...step, id, title: `${step.title} (2)`, detail: step.detail.slice(at).trim(), why:'',exceptions:'',supplement:'',narration:[],materials:[],evidence };
  return StudioDocumentSchema.parse({ ...document, steps: [...document.steps.slice(0,index),first,second,...document.steps.slice(index+1)] });
}
