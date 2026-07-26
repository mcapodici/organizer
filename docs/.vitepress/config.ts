import { defineConfig } from 'vitepress';

// Official GitHub "octocat" mark, sourced from the simple-icons path data
// bundled with vitepress (node_modules/@iconify-json/simple-icons/icons.json
// -> icons.github.body, viewBox "0 0 24 24"). Reused inline so it can sit
// next to the "Source" nav link without a custom theme component.
const octocatSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>';

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

  // The app lives at /app/ but is built by Vite separately, so VitePress can't
  // resolve it as a docs page. Don't flag in-page links to it as dead.
  ignoreDeadLinks: [/^\/app\//],

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
      { text: 'Blog', link: '/blog/' },
      {
        text: `<span style="display:inline-flex;align-items:center;gap:4px;">${octocatSvg} Source</span>`,
        link: '/source',
      },
      // `target: _self` forces a real browser navigation to the app instead of
      // letting VitePress's client router try (and fail) to resolve /app/ as a
      // docs page.
      { text: 'Open App', link: '/app/', target: '_self', rel: 'nofollow' },
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
      // Blog posts aren't listed individually here — the /blog/ index is the
      // auto-generated list (see blog/posts.data.ts). The sidebar just offers a
      // way back to that index from a post.
      '/blog/': [
        {
          text: 'Blog',
          items: [
            { text: 'All posts', link: '/blog/' },
          ],
        },
      ],
    },

    editLink: {
      pattern: 'https://github.com/mcapodici/organizer/edit/main/docs/:path',
      text: 'Suggest changes to this page',
    },

    docFooter: {
      prev: true,
      next: true,
    },
  },
});
