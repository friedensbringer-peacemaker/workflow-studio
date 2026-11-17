import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudioDocument } from './empty-document';
import { DEFAULT_BRANDING, brandTitle } from './branding';
test('new manual projects have no process content or media and do not share state', () => {
 const first=emptyStudioDocument('studio-process-first', 123), second=emptyStudioDocument('studio-process-second', 124);
 assert.equal(first.sessionId,'studio-process-first'); assert.equal(first.updatedAt,123);
 assert.deepEqual(first.steps,[]); assert.equal(first.intent,''); assert.equal(first.transcript,'');
 first.title='Edited'; assert.equal(second.title,'Neuer Prozess'); assert.notStrictEqual(first.steps,second.steps);
 assert.equal(DEFAULT_BRANDING.companyName,''); assert.equal(DEFAULT_BRANDING.logo,''); assert.equal(brandTitle(DEFAULT_BRANDING),'Workflow Studio');
});
