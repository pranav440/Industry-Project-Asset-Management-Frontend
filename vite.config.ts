import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function spaFallback() {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url || '/'
        const qi = raw.indexOf('?')
        const path = qi >= 0 ? raw.slice(0, qi) : raw
        if (
          path.includes('.') ||
          path === '/' ||
          path.startsWith('/@') ||
          path.startsWith('/src') ||
          path.startsWith('/node_modules') ||
          path.startsWith('/assets') ||
          path.startsWith('/favicon')
        ) {
          return next()
        }
        req.url = '/index.html' + (qi >= 0 ? raw.slice(qi) : '')
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), spaFallback()],
})
