import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
      output: {
        // Warn at 50KB, fail at 150KB per chunk
        experimentalMinChunkSize: 0,
      },
    },
    // Bundle size budget: warn if any asset exceeds 50KB
    chunkSizeWarningLimit: 50,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    root: '.',
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
