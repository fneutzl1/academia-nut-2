// Run a pull without the server, e.g. from Heroku Scheduler:
//   pnpm --filter @academia-nut/admin pull curricunet-courses     (built)
//   pnpm --filter @academia-nut/admin pull:dev curricunet-courses (local, tsx)
import { defaultDataDir, FileStore, loadRootEnv } from '@academia-nut/core';
import { getSource, runSource, sources } from '@academia-nut/pipeline';

loadRootEnv();

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.log(`Usage: pull <source-id|all>...\nSources: ${sources.map((s) => s.id).join(', ')}`);
  process.exit(1);
}

const selected = ids.includes('all') ? sources : ids.map((id) => getSource(id) ?? (console.error(`Unknown source ${id}`), process.exit(1)));
const store = new FileStore(defaultDataDir());

let failed = false;
for (const source of selected) {
  const status = await runSource(source, store, (s) => console.log(`[${source.id}] ${s.message}`));
  for (const warning of status.warnings) console.warn(`[${source.id}] warn: ${warning}`);
  failed ||= status.state === 'failed';
}
process.exit(failed ? 1 : 0);
