import { FileStore } from '@academia-nut/core';
import { createDb } from '@academia-nut/db';
import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp({
  store: new FileStore(config.dataDir),
  corsOrigins: config.corsOrigins,
  db: config.databaseUrl ? createDb(config.databaseUrl) : undefined,
});

app.listen(config.port, () => {
  console.log(`api listening on http://localhost:${config.port} (data: ${config.dataDir}${config.databaseUrl ? ', catalog: postgres' : ''})`);
});
