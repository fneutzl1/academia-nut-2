import { defineConfig } from 'tsup';

// Workspace packages ship TypeScript source, so bundle them into the app.
// This app's own deps stay external; deps of workspace packages (sanitize-html,
// zod) get bundled, so give bundled CommonJS a real `require`.
export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  noExternal: [/^@academia-nut\//],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  clean: true,
});
