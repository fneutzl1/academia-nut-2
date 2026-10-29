import path from 'node:path';
import { defaultDataDir, findRepoRoot, loadRootEnv, requireEnv } from '@academia-nut/core';

loadRootEnv();

export const config = {
  // Heroku assigns PORT; ADMIN_PORT is for running both apps locally
  port: Number(process.env.PORT ?? process.env.ADMIN_PORT ?? 4001),
  adminToken: requireEnv('ADMIN_TOKEN'),
  dataDir: defaultDataDir(),
  // Read at runtime (not baked into the UI build) so one slug can be promoted test -> prod
  publicApiUrl: process.env.PUBLIC_API_URL ?? '',
  // Optional while JSON files are still the primary store: pulls also write catalog-year tables when set
  databaseUrl: process.env.DATABASE_URL,
  webDist: path.join(findRepoRoot(), 'apps', 'admin-web', 'dist'),
};
