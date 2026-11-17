import { app } from 'electron';
import path from 'node:path';
import { DeletionProtection } from './studio/deletion-protection';
let protection: DeletionProtection | undefined;
export const deletionProtection = () => protection ??= new DeletionProtection(path.join(app.getPath('userData'), 'deletion-protection.json'));
