import { readFile, writeFile } from 'node:fs/promises';
const matrix = JSON.parse(await readFile(new URL('../common/ui-translations.json', import.meta.url), 'utf8'));
const cell = text => `"${text.replaceAll('"', '""')}"`;
const rows = [['Key', 'Deutsch', 'English'], ...Object.entries(matrix).map(([key, row]) => [key, row.de, row.en])];
await writeFile(new URL('../docs/fork/TRANSLATIONS.csv', import.meta.url), '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n');
console.log(`Exported ${rows.length - 1} translation entries.`);
