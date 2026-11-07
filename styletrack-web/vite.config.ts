import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the API is proxied so the browser sees one origin (no CORS setup needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_TARGET ?? 'http://localhost:8080',
    },
  },
});
