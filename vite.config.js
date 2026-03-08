import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000, // Inline small assets
  },
});
