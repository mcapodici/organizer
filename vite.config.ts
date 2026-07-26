import { defineConfig } from 'vitest/config';
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

// The app is served under "/app/" so it can sit alongside the VitePress
// marketing + docs site, which owns the root "/". Everything the app emits
// lives under dist/app/ with "/app/"-prefixed asset URLs, so it can never
// collide with the docs site at the root. Redirect the bare "/app" to "/app/"
// in dev and preview before Vite's SPA fallback resolves it. Registering the
// middleware directly (not via a returned thunk) places it ahead of Vite's
// internal middlewares.
function appTrailingSlash(): Plugin {
  const redirect: Connect.NextHandleFunction = (req, res, next) => req.url === '/app'
    ? (res.writeHead(301, { Location: '/app/' }), res.end())
    : next();
  return {
    name: 'app-trailing-slash',
    configureServer(server: ViteDevServer) { server.middlewares.use(redirect); },
    configurePreviewServer(server: PreviewServer) { server.middlewares.use(redirect); },
  };
}

function getBuildInfo(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const date = execSync('git log -1 --format=%ci').toString().trim();
    return `${hash} · ${date}`;
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // Served at "/app/" — the VitePress docs site owns the root.
  base: '/app/',
  plugins: [
    react(),
    appTrailingSlash(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg'],
      manifest: {
        name: 'Organizer',
        short_name: 'Organizer',
        description: 'A timeline-based personal organizer',
        theme_color: '#6366f1',
        background_color: '#f9fafb',
        display: 'standalone',
        scope: '/app/',
        start_url: '/app/',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: 'pwa-192x192-maskable.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: 'pwa-512x512-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [
          {
            // App shell — network first with cache fallback
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            // Static assets — cache first
            urlPattern: ({ request }) =>
              request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'font' ||
              request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // Fixed port so the docs dev server (5173) can proxy /app/* here. The HMR
    // client connects straight to 5174, so hot reload works whether the app is
    // opened directly (app:dev) or through the docs proxy (dev).
    port: 5174,
    strictPort: true,
    hmr: { clientPort: 5174 },
  },
  define: {
    __BUILD_INFO__: JSON.stringify(getBuildInfo()),
  },
  build: {
    // Emit into dist/app so the docs build (which writes the rest of dist/)
    // and the app never overwrite each other. emptyOutDir only clears
    // dist/app, leaving the docs output at the root of dist/ intact.
    outDir: 'dist/app',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    // Windows bind-mount I/O over node_modules is slow enough that `forks`
    // (a fresh OS process + module resolution per worker) times out on
    // startup. `threads` share one process/module cache, avoiding that cost.
    pool: 'threads',
  },
});
