import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The React app lives in client/ and builds to dist/, which the Express
// server serves in production. In dev, Vite proxies /api to that server.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3001}` },
  },
})
