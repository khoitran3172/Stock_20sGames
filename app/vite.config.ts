import { defineConfig } from 'vite';

// base './' để chạy được dưới /Stock_20sGames/app/ trên GitHub Pages.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
