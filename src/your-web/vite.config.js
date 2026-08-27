import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// GitHub Pages serves a project site from /<repo>/, not the domain root.
// Derive the base path from GITHUB_REPOSITORY (set by Actions) so this works
// for whatever repo it's deployed from, without hardcoding a name; local dev
// and non-GitHub builds stay at the root.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : '/';

export default defineConfig({
  base,
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
