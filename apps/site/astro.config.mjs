// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

const packages = new URL('../../packages/', import.meta.url);
const reactSrc = fileURLToPath(new URL('react/src', packages));
const svelteLib = fileURLToPath(new URL('svelte/src/lib', packages));
const coreSrc = fileURLToPath(new URL('core/src/index.ts', packages));

export default defineConfig({
  // Set so the sitemap Starlight emits has absolute URLs (and to silence its warning).
  site: 'https://sg-widgets.dev',
  integrations: [
    starlight({
      title: 'sg-widgets',
      description: 'shadcn-compatible widgets for Flow Production Tracking, for React and Svelte.',
      customCss: ['./src/styles/global.css'],
      sidebar: [
        { label: 'Start', items: [{ label: 'Introduction', slug: 'start/introduction' }] },
        { label: 'Widgets', items: [{ autogenerate: { directory: 'widgets' } }] },
        { label: 'Core', items: [{ autogenerate: { directory: 'core' } }] },
      ],
    }),
    react(),
    svelte(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Every demo is discovered at startup, so the optimizer bundles all dependencies once
    // instead of re-bundling on first visit and answering the in-flight requests with 504.
    optimizeDeps: {
      entries: ['src/demos/**/*.{svelte,tsx,ts}', 'src/components/**/*.astro'],
      include: ['react', 'react-dom', 'react-dom/client', 'lucide-react', 'cn', 'clsx', 'tailwind-merge', 'bits-ui'],
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
