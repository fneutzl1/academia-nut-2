import { FileStore } from '@academia-nut/core';
import { catalogWriter, createDb } from '@academia-nut/db';
import { createApp } from './app.js';
import { config } from './config.js';

const db = config.databaseUrl ? createDb(config.databaseUrl) : undefined;
const app = createApp({
  store: new FileStore(config.dataDir),
  catalog: db ? catalogWriter(db) : undefined,
  db,
  adminToken: config.adminToken,
  publicApiUrl: config.publicApiUrl,
  webDist: config.webDist,
});

app.listen(config.port, () => {
  console.log(`admin listening on http://localhost:${config.port} (data: ${config.dataDir}${config.databaseUrl ? ', catalog: postgres' : ''})`);
});
