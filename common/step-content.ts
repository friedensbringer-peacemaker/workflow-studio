import type {StudioStep} from './studio';
export type ContentTag = 'Screenshot'|'Sprache'|'Text'|'Video'|'Datei';
export function stepContentTags(step:StudioStep):ContentTag[]{
 const tags:ContentTag[]=[];
 if(step.frame||step.image||step.evidence?.some(e=>e.frame)||step.materials?.some(m=>m.kind==='image'))tags.push('Screenshot');
 if(step.narration?.length||step.materials?.some(m=>m.kind==='audio'))tags.push('Sprache');
 if([step.detail,step.why,step.exceptions,step.supplement].some(v=>v?.trim()))tags.push('Text');
 if(step.materials?.some(m=>m.kind==='video'))tags.push('Video');
 if(step.materials?.some(m=>m.kind==='document'))tags.push('Datei');
 return tags;
}
