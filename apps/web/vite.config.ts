/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base relativa: permite alojar la interfaz en GitHub Pages o empaquetarla en Tauri.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['../../tests/frontend/**/*.test.ts'],
    environment: 'node',
  },
});
