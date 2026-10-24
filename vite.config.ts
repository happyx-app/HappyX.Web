import { defineConfig } from 'vite'

// In development, run the API locally and let Vite forward /api/web like nginx does in production:
//   API_URL=http://localhost:8083 npm run dev
export default defineConfig({
  server: {
    port: 8084,
    proxy: {
      '/api/web': {
        target: process.env.API_URL ?? 'http://localhost:8083',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
