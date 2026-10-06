import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the side panel page. public/ (manifest.json, background.js, icon) is copied to dist/ as-is.
// Load dist/ as an unpacked extension in chrome://extensions.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // loaded from disk, not over the network
    rollupOptions: { input: { sidepanel: 'sidepanel.html' } }
  }
});
