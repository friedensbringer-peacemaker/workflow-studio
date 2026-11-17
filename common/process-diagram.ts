import type { StudioDocument } from './studio';
import { narrationText } from './studio-narration';
import { DEFAULT_BRANDING, BrandingSchema, brandTitle, type Branding } from './branding';

const xml = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const mermaidText = (s: string) => s.replace(/[&<>"`#\[\]{}\\\n\r]/g, c => c === '\n' || c === '\r' ? ' ' : '#' + c.charCodeAt(0) + ';');
function notes(s: StudioDocument['steps'][number]): string {
  return [narrationText(s) && 'Erklärung: ' + narrationText(s), s.why && 'Warum: ' + s.why, s.exceptions && 'Ausnahmen / offene Fragen: ' + s.exceptions, s.supplement && 'Ergänzung: ' + s.supplement].filter(Boolean).join('\n\n');
}
/** A sequence with annotations. Free-text exceptions never silently become decision branches. */
export function processMermaid(doc: StudioDocument): string {
  const lines = ['flowchart TD', '  start(["Start"])'];
  doc.steps.forEach((s, i) => {
    lines.push('  s' + i + '["' + mermaidText((i + 1) + '. ' + s.title + (s.detail ? ': ' + s.detail : '')) + '"]');
    if (notes(s)) lines.push('  n' + i + '["' + mermaidText(notes(s)) + '"]', '  s' + i + ' -.- n' + i);
    lines.push('  ' + (i ? 's' + (i-1) : 'start') + ' --> s' + i);
  });
  lines.push('  endNode(["Ende"])', '  ' + (doc.steps.length ? 's' + (doc.steps.length - 1) : 'start') + ' --> endNode');
  return lines.join('\n') + '\n';
}
function wrap(text: string, width = 55): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (line.length + word.length + 1 > width && line) { lines.push(line); line = ''; }
      for (let i = 0; i < word.length; i += width) { const part = word.slice(i, i + width); if (i) { lines.push(line); line = ''; } line += (line ? ' ' : '') + part; }
    }
    lines.push(line);
  }
  return lines;
}
function diagramRows(doc: StudioDocument) {
  let y = 160;
  return doc.steps.map((s, i) => {
    const text = wrap((i + 1) + '. ' + s.title + (s.detail ? '\n' + s.detail : ''), 48);
    const note = notes(s) ? wrap(notes(s), 52) : [];
    const height = Math.max(72, Math.max(text.length, note.length) * 20 + 28);
    const row = { y, height, text, note }; y += height + 48; return row;
  });
}
export function processSvg(doc: StudioDocument, input: Branding = DEFAULT_BRANDING): string {
  const b = BrandingSchema.parse(input), rows = diagramRows(doc);
  const endY = rows.length ? rows.at(-1)!.y + rows.at(-1)!.height + 48 : 160;
  const text = (lines: string[], x: number, y: number) => '<text x="' + x + '" y="' + y + '" font-family="Arial,sans-serif" font-size="14" fill="#212121">' + lines.map((l,i) => '<tspan x="' + x + '" dy="' + (i ? 20 : 0) + '">' + xml(l) + '</tspan>').join('') + '</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="' + (endY + 96) + '" viewBox="0 0 1000 ' + (endY + 96) + '"><title>' + xml(doc.title) + '</title><desc>Schrittfolge mit ergänzenden Hinweisen. Keine automatisch abgeleiteten Entscheidungszweige.</desc><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#666"/></marker></defs><rect width="100%" height="100%" fill="white"/>' + text([brandTitle(b), doc.title], 32, 28) + '<rect x="32" y="70" width="936" height="3" fill="' + b.primary + '"/><rect x="185" y="98" width="120" height="32" rx="16" fill="#f4f4f4" stroke="#777"/>' + text(['Start'], 225, 120) +
    rows.map((r, i) => '<path d="M245 ' + (i ? rows[i-1].y + rows[i-1].height : 130) + ' V' + (r.y-5) + '" stroke="#666" fill="none" marker-end="url(#arrow)"/><rect x="32" y="' + r.y + '" width="426" height="' + r.height + '" rx="6" fill="#fafafa" stroke="' + b.secondary + '"/>' + text(r.text, 48, r.y + 26) + (r.note.length ? '<path d="M458 ' + (r.y+24) + ' H510" stroke="#999" stroke-dasharray="5 4"/><rect x="510" y="' + r.y + '" width="458" height="' + r.height + '" rx="6" fill="#fff" stroke="#ccc"/>' + text(r.note, 526, r.y+26) : '')).join('') + '<path d="M245 ' + (rows.length ? rows.at(-1)!.y + rows.at(-1)!.height : 130) + ' V' + (endY-5) + '" stroke="#666" marker-end="url(#arrow)"/><rect x="185" y="' + endY + '" width="120" height="32" rx="16" fill="#f4f4f4" stroke="#777"/>' + text(['Ende'], 225, endY+22) + '</svg>';
}
export function processDrawio(doc: StudioDocument, input: Branding = DEFAULT_BRANDING): string {
  const b = BrandingSchema.parse(input), rows = diagramRows(doc); let cells = '';
  const vertex = (id: string, label: string, x: number, y: number, w: number, h: number, style: string) => '<mxCell id="' + id + '" value="' + xml(label) + '" style="html=0;whiteSpace=wrap;fontSize=14;' + style + '" vertex="1" parent="1"><mxGeometry x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" as="geometry"/></mxCell>';
  const edge = (id: string, from: string, to: string, note = false) => '<mxCell id="' + id + '" style="edgeStyle=orthogonalEdgeStyle;html=0;endArrow=' + (note ? 'none;dashed=1' : 'block') + ';" edge="1" parent="1" source="' + from + '" target="' + to + '"><mxGeometry relative="1" as="geometry"/></mxCell>';
  cells += vertex('heading', brandTitle(b) + '\n' + doc.title, 32, 16, 850, 56, 'text;strokeColor=none;fillColor=none;align=left;');
  cells += vertex('start', 'Start', 185, 98, 120, 32, 'rounded=1;arcSize=50;fillColor=' + b.primary + ';');
  rows.forEach((r,i) => { cells += vertex('s'+i, r.text.join('\n'), 32,r.y,426,r.height,'rounded=1;fillColor=#fafafa;strokeColor='+b.secondary+';') + edge('e'+i,i?'s'+(i-1):'start','s'+i); if(r.note.length) cells += vertex('n'+i,r.note.join('\n'),510,r.y,458,r.height,'shape=note;fillColor=#ffffff;strokeColor=#cccccc;') + edge('a'+i,'s'+i,'n'+i,true); });
  cells += vertex('end','Ende',185,rows.length ? rows.at(-1)!.y + rows.at(-1)!.height+48 : 160,120,32,'rounded=1;arcSize=50;fillColor='+b.primary+';') + edge('last',rows.length?'s'+(rows.length-1):'start','end');
  return '<?xml version="1.0" encoding="UTF-8"?><mxfile host="Workflow Studio"><diagram id="process" name="Prozess"><mxGraphModel grid="1" page="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>' + cells + '</root></mxGraphModel></diagram></mxfile>';
}
