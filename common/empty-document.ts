import { StudioDocumentSchema, type StudioDocument } from './studio';
/** A manually created project contains no sample steps, media or narration. */
export function emptyStudioDocument(sessionId: string, now = Date.now()): StudioDocument {
  return StudioDocumentSchema.parse({version: 1, sessionId, title: 'Neuer Prozess', intent: '', transcript: '', updatedAt: now, steps: []});
}
