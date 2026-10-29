import { FileStore } from '@academia-nut/core';
import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp({
  store: new FileStore(config.dataDir),
  adminToken: config.adminToken,
  publicApiUrl: config.publicApiUrl,
  webDist: config.webDist,
});

app.listen(config.port, () => {
  console.log(`admin listening on http://localhost:${config.port} (data: ${config.dataDir})`);
});
