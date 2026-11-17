import type {StudioStep} from '../common/studio';
import {tr} from './i18n';
const time=(ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
export function RecordingNotes({step,disabled,onChange}:{step:StudioStep;disabled:boolean;onChange:(patch:Partial<StudioStep>)=>void}) {
  if(!step.narration?.length)return null;
  return <section className="recording-notes"><h3>{tr('Erklärungen aus der Aufnahme')}</h3><p>{tr('Nach Zeit zugeordnet. Text prüfen, bearbeiten oder einem Feld zuweisen.')}</p>{step.narration.map(n=><div key={n.id}>
    <label>{time(n.atMs)} – {time(n.endMs)}<textarea aria-label={`${tr('Aufnahmeerklärung')} ${time(n.atMs)}`} rows={3} value={n.text} maxLength={12000} disabled={disabled} onChange={e=>onChange({narration:step.narration?.map(v=>v.id===n.id?{...v,text:e.target.value}:v)})}/></label>
    <details><summary>{tr('Einem Feld zuweisen')}</summary><div className="studio-material-actions">{([['detail','Beschreibung'],['why','Begründung'],['exceptions','Ausnahmen'],['supplement','Zusätzliche Notizen']] as const).map(([key,label])=><button key={key} disabled={disabled||[step[key],n.text].filter(Boolean).join('\n\n').length>(key==='why'||key==='exceptions'?6000:12000)} onClick={()=>onChange({[key]:[step[key],n.text].filter(Boolean).join('\n\n'),narration:step.narration?.filter(v=>v.id!==n.id)})}>{tr(label)}</button>)}</div></details>
  </div>)}</section>;
}
