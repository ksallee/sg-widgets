// @ts-check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

const packages = new URL('../../packages/', import.meta.url);
const reactSrc = fileURLToPath(new URL('react/src', packages));
const svelteLib = fileURLToPath(new URL('svelte/src/lib', packages));
const coreSrc = fileURLToPath(new URL('core/src/index.ts', packages));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// Inlined in the head, so the stored palette is on `:root` before the first paint. Read
// as text rather than imported: this file is the head entry, not a module the page runs.
const paletteBoot = readFileSync(new URL('./src/scripts/palette-boot.js', import.meta.url), 'utf8');

export default defineConfig({
  // Set so the sitemap Starlight emits has absolute URLs (and to silence its warning).
  site: 'https://sg-widgets.dev',
  // Every page is prerendered. The adapter is here for the three endpoints under
  // src/pages/live/, which opt out with `export const prerender = false`: the two
  // App Session Launcher calls the browser cannot make itself, and the dev-only
  // token endpoint.
  adapter: node({ mode: 'standalone' }),
  integrations: [
    starlight({
      title: 'sg-widgets',
      description: 'shadcn-compatible widgets for Flow Production Tracking, for React and Svelte.',
      customCss: ['./src/styles/global.css'],
      head: [{ tag: 'script', content: paletteBoot }],
      // The code block is a surface of the page like a card is: the frame, its border
      // and its corners come from the tokens, and only the syntax colours stay
      // Starlight's own. Starlight already draws the frame background from
      // `--sl-color-gray-6/7`; these are the settings it leaves on Expressive Code's
      // defaults.
      expressiveCode: {
        styleOverrides: {
          borderRadius: 'var(--radius)',
          codeBackground: 'var(--sl-color-bg-inline-code)',
          codeFontFamily: 'var(--sl-font-mono)',
          codeSelectionBackground: 'var(--sl-color-accent-low)',
          uiFontFamily: 'var(--sl-font)',
        },
      },
      // The palette and what the demos read are site-wide, so they sit in the header
      // beside the search box and the theme select. Starlight's own header takes no
      // props and offers no slot, so the override is a copy of it.
      components: { Header: './src/components/overrides/Header.astro' },
      sidebar: [
        { label: 'Start', items: [{ label: 'Introduction', slug: 'start/introduction' }] },
        {
          label: 'Core',
          items: [{ autogenerate: { directory: 'core' } }],
        },
        {
          label: 'Widgets',
          items: [
            { label: 'Overview', slug: 'widgets' },
            {
              label: 'Foundations',
              items: ['thumbnail', 'user-avatar', 'text-editor', 'number-editor', 'checkbox-editor', 'date-editor', 'date-time-editor', 'list-select', 'list-multi-select', 'url-editor', 'color-editor'].map((n) => ({ slug: `widgets/${n}` })),
            },
            {
              label: 'Display',
              items: ['status-badge', 'entity-chip', 'entity-card', 'field-value'].map((n) => ({ slug: `widgets/${n}` })),
            },
            {
              label: 'Pickers',
              items: ['entity-picker', 'entity-multi-picker', 'user-picker', 'project-picker', 'status-picker', 'status-multi-picker', 'entity-type-picker', 'field-picker', 'column-picker', 'field-editor', 'global-search', 'hierarchical-search', 'context-selector'].map((n) => ({ slug: `widgets/${n}` })),
            },
            {
              label: 'Queries and collections',
              items: ['filter-editor', 'filter-dialog', 'filter-bar', 'sort-picker', 'entity-table', 'entity-grid', 'grouped-list', 'entity-tree'].map((n) => ({ slug: `widgets/${n}` })),
            },
          ],
        },
      ],
    }),
    react(),
    svelte(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // The monorepo keeps one `.env.local` at its root. The dev-token endpoint reads the
    // script key from it, and `PUBLIC_FPT_SITE_URL` fills the Connect panel's site field.
    envDir: repoRoot,
    // Every demo is discovered at startup, so the optimizer bundles all dependencies once
    // instead of re-bundling on first visit and answering the in-flight requests with 504.
    optimizeDeps: {
      entries: ['src/demos/**/*.{svelte,tsx,ts}', 'src/components/**/*.astro'],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'lucide-react',
        'cn',
        'clsx',
        'tailwind-merge',
        'bits-ui',
        '@tanstack/react-table',
        '@tanstack/react-virtual',
        '@tanstack/svelte-table',
        '@tanstack/virtual-core',
      ],
    },
    resolve: {
      // Demo islands import registry sources straight out of the workspace packages,
      // with the same specifiers a published registry item uses, so what the demo
      // compiles is byte-for-byte the file a user installs.
      //
      // These are whole-segment matches (rollup-plugin-alias semantics: the specifier
      // must equal the key or start with `key + '/'`), so `@astrojs/react`,
      // `@base-ui/react` and friends are left alone by the `@` entry.
      alias: [
        // Core is aliased to its TypeScript source rather than the `dist/index.mjs`
        // its package entry points name. Two reasons: `pnpm --filter site build` then
        // needs no prior `pnpm --filter @sg-widgets/core build`, and `astro dev`
        // hot-reloads an edit to packages/core straight into the open demo page,
        // which watching a build output does not.
        { find: '@sg-widgets/core', replacement: coreSrc },
        { find: '@', replacement: reactSrc },
        { find: '$lib', replacement: svelteLib },
      ],
      // The workspace packages carry their own react/svelte; keep one copy each so
      // hooks and runes work across the island boundary.
      dedupe: ['react', 'react-dom', 'svelte'],
    },
  },
});
