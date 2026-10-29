import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Load the root .env and bring the test database up to the current migrations
 * (if one is configured). `migrate deploy` only applies pending migrations; the
 * tests truncate their own tables, and only in a database named *_test.
 */
export default function setup(): void {
  const rootEnv = path.resolve(import.meta.dirname, '../../../../.env');
  if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  if (!/_test(\?|$)/.test(new URL(url).pathname + new URL(url).search)) {
    throw new Error('TEST_DATABASE_URL must point at a database whose name ends in _test');
  }
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(import.meta.dirname, '../..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
