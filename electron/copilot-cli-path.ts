import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { RuntimeConnection } from "@github/copilot-sdk";

const require = createRequire(import.meta.url);

/** Local fork fix: process spawning needs the physical unpacked executable. */
export function unpackedCopilotPath(resolved: string): string {
  const unpacked = resolved.replace(/([\\/])app\.asar([\\/])/i, '$1app.asar.unpacked$2');
  if (unpacked !== resolved) {
    if (!existsSync(unpacked)) throw new Error('Bundled Copilot executable is missing from app.asar.unpacked.');
    return unpacked;
  }
  return resolved;
}

/**
 * Resolve the path to the bundled Copilot CLI binary. The SDK's own resolution
 * (`getBundledCliPath`) uses `import.meta.resolve` relative to its bundle location,
 * which fails when the SDK is externalized by Vite (the bundle lives in dist-electron/
 * but node_modules is a sibling). We resolve it ourselves via createRequire anchored
 * to *this* file's pre-bundle location, which correctly finds node_modules.
 */
export function resolveCopilotCliPath(): string | undefined {
  const platform = process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch;
  const packageName = `@github/copilot-${platform}-${arch}`;
  try {
    const resolved = require.resolve(packageName);
    if (existsSync(resolved)) return unpackedCopilotPath(resolved);
  } catch {}
  try {
    const pkgDir = path.dirname(require.resolve(`${packageName}/package.json`));
    const binName = process.platform === "win32" ? "copilot.exe" : "copilot";
    const binPath = path.join(pkgDir, binName);
    if (existsSync(binPath)) return unpackedCopilotPath(binPath);
  } catch {}
  return undefined;
}

/**
 * Build the connection option for `new CopilotClient(...)` that points to the
 * resolved CLI binary, or undefined to let the SDK try its own resolution.
 */
export function copilotConnectionOption() {
  const cliPath = resolveCopilotCliPath();
  return cliPath ? { connection: RuntimeConnection.forStdio({ path: cliPath }) } : undefined;
}

/** How long to wait for `client.start()` before giving up. */
const CLIENT_START_TIMEOUT_MS = 30_000;

/**
 * Race a promise against a timeout. Rejects with a clear message instead of
 * hanging indefinitely when the CLI binary can't be found or crashes silently.
 */
export function withStartupTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} did not start within ${CLIENT_START_TIMEOUT_MS / 1000}s. Is the Copilot CLI binary accessible?`)),
      CLIENT_START_TIMEOUT_MS,
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
