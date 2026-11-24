import { defineConfig } from 'vite';

export default defineConfig({
  // '/' locally; the GitHub Pages workflow builds with BASE_PATH=/connext-website/
  // so every asset URL (HTML, CSS and import.meta.env.BASE_URL in JS) gets that prefix
  base: process.env.BASE_PATH || '/',
  server: { port: 5173, open: true },
  build: { target: 'es2020' },
});
