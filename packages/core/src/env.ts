import fs from 'node:fs';
import path from 'node:path';

/** Walk up from `start` until we find the pnpm workspace root. */
export function findRepoRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
  return dir;
}

/**
 * Load the repo-root `.env` in local dev. On Heroku there is no file and
 * config vars are already in process.env, so this is a no-op.
 */
export function loadRootEnv(): void {
  const file = path.join(findRepoRoot(), '.env');
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export function defaultDataDir(): string {
  return process.env.DATA_DIR ?? path.join(findRepoRoot(), 'data');
}
