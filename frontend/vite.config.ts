import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { port: 5178, proxy: { '/api': 'http://localhost:8088' } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          query: ['@tanstack/react-query', '@tanstack/react-query-persist-client'],
        },
      },
    },
  },
})
