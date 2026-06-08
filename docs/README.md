# Organizer documentation

User-facing guides, tutorials, and use cases for Organizer, built with
[VitePress](https://vitepress.dev). Content is plain Markdown; search is built in
(local, offline — no external service).

## Structure

```
docs/
├── .vitepress/
│   └── config.ts        # site config: nav, sidebar, search
├── public/              # static assets (logo, favicon)
├── index.md             # home page
├── guide/               # feature guides
├── tutorials/           # step-by-step walkthroughs
└── use-cases/           # ideas / scenarios
```

## Local development

From the repo root:

```bash
npm run dev            # run BOTH dev servers: docs (5173) + app (5174),
                       #   with /app/* proxied through 5173 so the dev origin
                       #   mirrors production (http://localhost:5173/)
npm run app:dev        # run only the app dev server (http://localhost:5174/app/)
npm run docs:dev       # run only the docs dev server (http://localhost:5173/)
npm run build          # full production build into dist/ (docs + app)
```

## Adding a page

1. Create a `.md` file under `guide/`, `tutorials/`, or `use-cases/`.
2. Add it to the relevant `sidebar` section in `.vitepress/config.ts`.
3. Link to it from related pages. Search indexes it automatically.

## How this fits the deployed site

The docs site and the app ship together as **one Vercel deployment** on a single
domain — there is no separate docs subdomain:

```
/              → VitePress home (marketing hero)
/guide/...     → VitePress docs
/tutorials/... → VitePress
/use-cases/    → VitePress
/app/          → the React app (hash routing)
```

The root `npm run build` produces a single `dist/`:

1. `vitepress build docs` writes the docs site to the **root** of `dist/`
   (configured via `outDir: '../dist'` in `.vitepress/config.ts`).
2. `vite build` writes the app to `dist/app/` with `base: '/app/'`, so its
   assets live at `/app/assets/*` and never collide with the docs site's
   `/assets/*`.

Because the docs build runs first and the app build only clears `dist/app/`,
the two outputs coexist cleanly. The existing root `vercel.json` already runs
`npm run build` and serves `dist/`, so no separate Vercel project is needed.

The "Open App Now" buttons (hero + top nav) link to `/app/` with `target: _self`
so they perform a real navigation into the app rather than a VitePress in-site
route.

> The `editLink` URL in `.vitepress/config.ts` currently points at
> `your-org/timeline-app` — update it to the real GitHub repo so "Suggest
> changes" links resolve.
