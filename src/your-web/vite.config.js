import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landscape: resolve(__dirname, 'landscape.html'),
        community: resolve(__dirname, 'community.html'),
        health: resolve(__dirname, 'health.html'),
        impact: resolve(__dirname, 'impact.html'),
        coverage: resolve(__dirname, 'coverage.html'),
      },
    },
  },
});
