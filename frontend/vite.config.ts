import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // onnxruntime-web's WASM loader does its own dynamic import() of a
    // companion .mjs glue file relative to its own dist folder; Vite's
    // dependency pre-bundling relocates the module and breaks that
    // resolution. Excluding it lets the browser load it straight from
    // node_modules (dev) / its own emitted chunk (build) instead.
    exclude: ['onnxruntime-web'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
