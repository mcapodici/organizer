import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// The app is served under "/app/" so it can sit alongside the VitePress
// marketing + docs site, which owns the root "/". Everything the app emits
// lives under dist/app/ with "/app/"-prefixed asset URLs, so it can never
// collide with the docs site at the root. Redirect the bare "/app" to "/app/"
// in dev and preview before Vite's SPA fallback resolves it. Registering the
// middleware directly (not via a returned thunk) places it ahead of Vite's
// internal middlewares.
function appTrailingSlash() {
  const redirect = (req: any, _res: any, next: any) => req.url === '/app'
    ? (_res.writeHead(301, { Location: '/app/' }), _res.end())
    : next();
  return {
    name: 'app-trailing-slash',
    configureServer(server: any) { server.middlewares.use(redirect); },
    configurePreviewServer(server: any) { server.middlewares.use(redirect); },
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
  plugins: [react(), appTrailingSlash()],
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
  },
} as any);
