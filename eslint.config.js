import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.claude', 'docs/.vitepress/dist', 'docs/.vitepress/cache']),
  {
    // App code. React rules are scoped to src/ so they are not applied to build
    // tooling or the Vue-based VitePress theme. Any future .ts/.tsx added
    // outside src/ needs its own block below.
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Build tooling and the VitePress site. Node globals for vite.config.ts
    // (process, child_process); browser globals for the theme, which touches
    // document and ResizeObserver.
    files: ['vite.config.ts', 'docs/.vitepress/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // Playwright harnesses. These interleave Node code with page.evaluate /
    // page.addInitScript callbacks that run in the browser, so both global
    // sets are needed.
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
