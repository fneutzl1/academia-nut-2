import { FileStore } from '@academia-nut/core';
import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp({ store: new FileStore(config.dataDir), corsOrigins: config.corsOrigins });

app.listen(config.port, () => {
  console.log(`api listening on http://localhost:${config.port} (data: ${config.dataDir})`);
});
