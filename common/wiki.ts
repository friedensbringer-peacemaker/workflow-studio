import { z } from 'zod';
import { documentMarkdown, type StudioDocument } from './studio';
import { reviewMarkdown, reviewSnapshot } from './process-review';
export const WikiTargetSchema = z.object({
  kind:z.enum(['markdown','outline','notion']), baseUrl:z.string().max(2000).default(''),
  parentId:z.string().max(100).default(''), folder:z.string().max(2000).default(''), hasKey:z.boolean().default(false),
});
export type WikiTarget = z.infer<typeof WikiTargetSchema>;
export const DEFAULT_WIKI_TARGETS: WikiTarget[] = ['markdown','outline','notion'].map(kind=>WikiTargetSchema.parse({kind}));
export function wikiMarkdown(doc: StudioDocument, includeReview = false): string {
  const content = documentMarkdown({...doc,transcript:'',interview:undefined,processReview:undefined,
    steps:doc.steps.map(s=>({...s,materials:[],frame:undefined,image:undefined,evidence:undefined}))});
  if (!includeReview || !doc.processReview) return content;
  const warning = doc.processReview.snapshot !== reviewSnapshot(doc) ? '\n\nHinweis: Prozess seit der Bewertung geändert.\n' : '';
  return content + warning + reviewMarkdown(doc.processReview);
}
