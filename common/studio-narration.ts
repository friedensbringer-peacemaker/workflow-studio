import { z } from 'zod';
import type { StudioDocument } from './studio';

export const StepNarrationSchema = z.object({id:z.string().max(100),atMs:z.number().finite().min(0),endMs:z.number().finite().min(0),text:z.string().max(12000)});
export const NarrationSourceSchema = z.object({startedAt:z.number().finite(),segments:z.array(StepNarrationSchema.omit({id:true})).max(2000)});
export type NarrationSource = z.infer<typeof NarrationSourceSchema>;

/** Assign each spoken segment once by overlap, using recording-relative vs epoch time explicitly. */
export function attachNarration(document:StudioDocument, source:NarrationSource):StudioDocument {
  const known = new Set([...(document.narrationImports??[]),...document.steps.flatMap(s=>(s.narration??[]).map(n=>n.id))]);
  let steps=document.steps.map(s=>({...s,narration:s.narration?.map(n=>({...n}))}));
  const fresh=source.segments.filter(s=>s.text.trim()&&s.endMs>=s.atMs).map(s=>({...s,id:`voice-${s.atMs}-${s.endMs}`})).filter(s=>!known.has(s.id));
  if(!fresh.length)return document;
  if(!steps.length)steps=[{id:'recording-narration',title:'Erklärung zur Aufnahme',detail:'',why:'',exceptions:'',app:'',source:'capture',startMs:source.startedAt,narration:[]}];
  const timed=steps.filter(s=>typeof s.startMs==='number'&&Number.isFinite(s.startMs)).sort((a,b)=>a.startMs!-b.startMs!);
  if(!timed.length)return document; // No invented association when time metadata is missing.
  for(const segment of fresh){
    if(known.has(segment.id))continue;
    const start=source.startedAt+segment.atMs,end=source.startedAt+segment.endMs;
    let target=timed[0],best=-1;
    timed.forEach((step,i)=>{
      const finish=step.endMs??timed[i+1]?.startMs??Math.max(end,step.startMs!+1);
      const overlap=Math.max(0,Math.min(end,finish)-Math.max(start,step.startMs!));
      if(overlap>best){best=overlap;target=step;}
    });
    if(best===0)target=[...timed].reverse().find(s=>s.startMs!<=start)??timed[0];
    target.narration=[...(target.narration??[]),segment];known.add(segment.id);
  }
  return {...document,steps,narrationImports:[...known]};
}

export const narrationText = (step:{narration?:{text:string}[]}) => (step.narration??[]).map(n=>n.text).filter(Boolean).join('\n\n');
