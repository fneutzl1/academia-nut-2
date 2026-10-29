import { defaultDataDir, loadRootEnv } from '@academia-nut/core';

loadRootEnv();

export const config = {
  // Heroku assigns PORT; API_PORT is for running both apps locally
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  dataDir: defaultDataDir(),
  databaseUrl: process.env.DATABASE_URL,
};
