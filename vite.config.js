import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000, // Inline small assets
  },
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
