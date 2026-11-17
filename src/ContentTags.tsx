import {stepContentTags,type ContentTag} from '../common/step-content';
import type {StudioStep} from '../common/studio';
import {tr} from './i18n';
import {StudioIcon} from './StudioIcon';
const icons={Screenshot:'monitor',Sprache:'record',Text:'edit',Video:'next',Datei:'download'} as const;
export function ContentTags({steps=[],tags:input}:{steps?:StudioStep[];tags?:ContentTag[]}){
 const tags=[...new Set(input??steps.flatMap(stepContentTags))];
 return tags.length?<span className="content-tags">{tags.map(t=><span key={t} className={'content-tag content-tag-'+t.toLowerCase()}><StudioIcon name={icons[t]}/>{tr(t)}</span>)}</span>:null;
}
