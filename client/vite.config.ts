import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

const PUBLIC_PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/offline.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon-180.png',
  '/icons/favicon-32.png',
];

/**
 * Genera dist/sw.js desde sw/sw.template.js con:
 * - lista de precache (app shell + assets del build)
 * - versión de caché = versión del paquete + hash de los archivos generados
 */
const serviceWorkerPlugin = (): Plugin => ({
  name: 'spa-service-worker',
  apply: 'build',
  generateBundle(_options, bundle) {
    // Solo se precachea el subconjunto latino de la fuente; el resto se cachea bajo demanda (cache first)
    const assets = Object.keys(bundle)
      .filter((f) => !f.endsWith('.html') && !f.endsWith('.map'))
      .filter((f) => !f.endsWith('.woff2') || /inter-latin-wght/.test(f))
      .map((f) => `/${f}`);
    const precache = [...PUBLIC_PRECACHE, ...assets];
    const hash = crypto.createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 10);
    const template = fs.readFileSync(path.resolve(__dirname, 'sw/sw.template.js'), 'utf8');
    this.emitFile({
      type: 'asset',
      fileName: 'sw.js',
      source: template
        .replace('__CACHE_VERSION__', `v${pkg.version}-${hash}`)
        .replace('__PRECACHE_URLS__', JSON.stringify(precache, null, 2)),
    });
  },
});

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Evita estilos/scripts inline para cumplir la CSP estricta
    assetsInlineLimit: 0,
  },
});
