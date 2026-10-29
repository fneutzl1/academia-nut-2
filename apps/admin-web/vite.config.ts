import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// In dev, proxy to the two Express apps so the UI needs no CORS setup.
// In production the admin server serves this build, and the API base URL
// comes from /admin-api/config at runtime.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/admin-api': 'http://localhost:4001',
      '/api': 'http://localhost:4000',
    },
  },
});
