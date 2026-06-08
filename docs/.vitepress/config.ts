import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Organizer',
  description: 'Local-first timelines for notes, events, and follow-ups — with rich text, attachments, tags, and todos.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,

  // Build the docs site into the shared dist/ root. The Vite app build writes
  // dist/app/ separately, so the two never collide. The docs build runs first
  // (it owns the root of dist/); the app build only clears dist/app/.
  outDir: '../dist',

  // README.md is contributor notes, not a published page.
  srcExclude: ['**/README.md'],

  // In dev, `npm run dev` runs this docs server (port 5173) alongside the app
  // dev server (port 5174). Proxy /app/* through to the app server so the dev
  // origin mirrors production: visiting http://localhost:5173/app/ Just Works
  // and the "Open App" links resolve. The app's HMR socket connects to 5174
  // directly (configured in vite.config.ts), so hot reload still works here.
  vite: {
    server: {
      proxy: {
        '/app': { target: 'http://localhost:5174', changeOrigin: false, ws: true },
      },
    },
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    // Hero wordmark font (Fraunces). Referenced from the Google CDN for now;
    // we can self-host it later to drop the third-party request.
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    // Built-in, offline, zero-config full-text search.
    search: {
      provider: 'local',
    },

    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Tutorials', link: '/tutorials/daily-journal' },
      { text: 'Use cases', link: '/use-cases/' },
      // `target: _self` forces a real browser navigation to the app instead of
      // letting VitePress's client router try (and fail) to resolve /app/ as a
      // docs page.
      { text: 'Open App ↗', link: '/app/', target: '_self', rel: 'nofollow' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Quick start', link: '/guide/getting-started' },
            { text: 'Storage & backup', link: '/guide/storage-and-backup' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Timelines', link: '/guide/timelines' },
            { text: 'Entries & rich text', link: '/guide/entries' },
            { text: 'Attachments', link: '/guide/attachments' },
            { text: 'Todos & due dates', link: '/guide/todos-and-due-dates' },
            { text: 'Tags & search', link: '/guide/tags-and-search' },
          ],
        },
      ],
      '/tutorials/': [
        {
          text: 'Tutorials',
          items: [
            { text: 'Keep a daily journal', link: '/tutorials/daily-journal' },
            { text: 'Track a project', link: '/tutorials/project-log' },
          ],
        },
      ],
      '/use-cases/': [
        {
          text: 'Use cases',
          items: [
            { text: 'Overview', link: '/use-cases/' },
          ],
        },
      ],
    },

    editLink: {
      pattern: 'https://codeberg.org/mcapodici/organizer/_edit/main/docs/:path',
      text: 'Suggest changes to this page',
    },

    docFooter: {
      prev: true,
      next: true,
    },
  },
});
