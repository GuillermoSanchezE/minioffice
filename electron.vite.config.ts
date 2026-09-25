import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, type Plugin } from 'vite'

// Solo en build: en dev, Vite inyecta scripts inline para el recargado en caliente.
// 'wasm-unsafe-eval' y modelos: son para el dictado (Whisper en WebAssembly).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' modelos:"
].join('; ')

// El motor de Whisper (onnxruntime-web) va dentro de la app, no desde un CDN.
const ORT_DIST = [
  resolve(__dirname, 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist'),
  resolve(__dirname, 'node_modules/onnxruntime-web/dist')
].find((d) => existsSync(d))!
const ORT_ARCHIVOS = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']

function motorWhisper(): Plugin {
  return {
    name: 'minioffice-ort',
    configureServer(server) {
      server.middlewares.use('/ort', (req, res, next) => {
        const nombre = (req.url ?? '').split('?')[0].replace(/^\//, '')
        if (!ORT_ARCHIVOS.includes(nombre)) return next()
        res.setHeader('Content-Type', nombre.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        createReadStream(join(ORT_DIST, nombre)).pipe(res)
      })
    },
    generateBundle() {
      for (const nombre of ORT_ARCHIVOS) {
        this.emitFile({ type: 'asset', fileName: `ort/${nombre}`, source: readFileSync(join(ORT_DIST, nombre)) })
      }
    }
  }
}

function cspEnProduccion(): Plugin {
  return {
    name: 'minioffice-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    // transformers.js carga su motor con import() dinámico: el worker va como módulo.
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@huggingface/transformers', 'onnxruntime-web'] },
    // La versión de onnxruntime-web que no mete su .wasm en el paquete: lo trae motorWhisper().
    resolve: { conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions] },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          grapadora: resolve(__dirname, 'src/renderer/grapadora.html')
        }
      }
    },
    plugins: [react(), cspEnProduccion(), motorWhisper()]
  }
})
