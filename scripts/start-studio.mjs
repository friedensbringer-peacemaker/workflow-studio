import { spawn } from 'node:child_process';
import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const nodeRoot = path.dirname(process.execPath);
const npm = path.join(nodeRoot, 'node_modules/npm/bin/npm-cli.js');
const electron = path.join(root, 'node_modules/electron/dist/electron.exe');
const exists = async file => { try { await access(file); return true; } catch { return false; } };

async function start() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor < 19) throw new Error('Node 24.19 oder neuer innerhalb Version 24 wird benoetigt.');
  if (!await exists(npm)) throw new Error('npm fehlt neben der Node-Laufzeit. Vollstaendige Node-Installation verwenden.');
  if (!await exists(electron)) throw new Error('Gepruefte Electron-Laufzeit fehlt. Siehe docs/fork/STUDIO.md.');
  if (process.argv.slice(2).some(arg => ['--check-only', '-CheckOnly'].includes(arg))) {
    console.log(`Studio-Startvoraussetzungen gefunden: Node ${process.versions.node}, npm und Electron. Kein PowerShell-Aufruf; kein Programm gestartet.`);
    return;
  }
  const env = { ...process.env, PATH: nodeRoot + path.delimiter + (process.env.PATH ?? ''), SKILL_RECORDER_OPEN_STUDIO: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  if (!env.SKILL_RECORDER_CODEX_CLI) {
    const pathCli = (env.PATH ?? '').split(path.delimiter).filter(Boolean).map(dir => path.join(dir, 'codex.exe'));
    for (const candidate of pathCli) if (await exists(candidate)) { env.SKILL_RECORDER_CODEX_CLI = candidate; break; }
    if (!env.SKILL_RECORDER_CODEX_CLI && env.LOCALAPPDATA) {
      const bins = path.join(env.LOCALAPPDATA, 'OpenAI/Codex/bin');
      const versions = await readdir(bins, { withFileTypes: true }).catch(() => []);
      const candidates = await Promise.all(versions.filter(entry => entry.isDirectory()).map(async entry => {
        const exe = path.join(bins, entry.name, 'codex.exe');
        return { exe, modified: await stat(exe).then(info => info.mtimeMs).catch(() => 0) };
      }));
      candidates.sort((a, b) => b.modified - a.modified);
      if (candidates[0]?.modified) env.SKILL_RECORDER_CODEX_CLI = candidates[0].exe;
    }
  }
  await new Promise((resolve, reject) => {
    const build = spawn(process.execPath, [npm, 'run', 'build'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    build.once('error', reject);
    build.once('close', code => code === 0 ? resolve() : reject(new Error(`Build fehlgeschlagen (${code}). Studio wurde nicht gestartet.`)));
  });
  const profile = path.join(root, '.local/studio-profile');
  await new Promise((resolve, reject) => {
    const app = spawn(electron, [root, `--user-data-dir=${profile}`], { cwd: root, env, detached: true, stdio: 'ignore', windowsHide: false });
    app.once('error', reject);
    app.once('spawn', () => { app.unref(); resolve(); });
  });
  console.log(`Studio-Start angefordert. Separates lokales Profil: ${profile}`);
}

start().catch(error => { console.error(error.message); process.exitCode = 1; });
