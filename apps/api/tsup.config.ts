import { defineConfig } from 'tsup';

// Workspace packages ship TypeScript source, so bundle them into the app.
// Third-party deps stay external and are installed on the dyno.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  noExternal: [/^@academia-nut\//],
  clean: true,
});
