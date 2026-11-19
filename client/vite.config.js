import { defineConfig } from 'vite';

// Request ke /api diteruskan ke server Express saat development.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
