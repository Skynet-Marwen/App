import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      // When accessing from another machine on the LAN, Vite's HMR WebSocket
      // must advertise the VM's IP, not "localhost". Set VITE_HMR_HOST in
      // docker-compose.dev.yml to the VM's LAN IP (e.g. 10.0.0.39).
      host: process.env.VITE_HMR_HOST || 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/tracker': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
