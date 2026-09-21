// @ts-check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, starlightSidebar } from './src/site-nav';

const packages = new URL('../../packages/', import.meta.url);
const reactSrc = fileURLToPath(new URL('react/src', packages));
const svelteLib = fileURLToPath(new URL('svelte/src/lib', packages));
const coreSrc = fileURLToPath(new URL('core/src/index.ts', packages));
const coreMockSrc = fileURLToPath(new URL('core/src/mock.ts', packages));
const baseUi = fileURLToPath(new URL('react/node_modules/@base-ui/react', packages));
const bitsUi = fileURLToPath(new URL('svelte/node_modules/bits-ui', packages));
const lucideReact = fileURLToPath(new URL('react/node_modules/lucide-react', packages));
const lucideSvelte = fileURLToPath(new URL('svelte/node_modules/@lucide/svelte', packages));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// Inlined in the head, so the stored palette is on `:root` before the first paint. Read
// as text rather than imported: this file is the head entry, not a module the page runs.
const paletteBoot = readFileSync(new URL('./src/scripts/palette-boot.js', import.meta.url), 'utf8');

export default defineConfig({
  // Set so the sitemap Starlight emits has absolute URLs (and to silence its warning).
  site: SITE_URL,
  // Every page is prerendered. The adapter is here for the three endpoints under
  // src/pages/live/, which opt out with `export const prerender = false`: the two
  // App Session Launcher calls the browser cannot make itself, and the dev-only
  // token endpoint. They become one Vercel function; the pages stay static files.
  adapter: vercel(),
  integrations: [
    // Starlight adds a sitemap of its own only when none is configured. This one
    // leaves out the three /qa/ harness pages, which are routes but not pages of
    // the site.
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/qa/') }),
    starlight({
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/ksallee/sg-widgets' }],
      // The mark alone, with the default palette's values pinned and its dark values
      // behind a `prefers-color-scheme` query inside the file, so it follows the OS.
      favicon: '/favicon.svg',
      customCss: ['./src/styles/global.css'],
      // The preview card a link to the site draws. The image is absolute, as the
      // crawlers require, and site-wide: every page shows the same screen. Starlight
      // writes `og:title`, `og:description` and `twitter:card` itself, and the Head
      // override mirrors the two it writes onto their `twitter:` names.
      head: [
        { tag: 'script', content: paletteBoot },
        { tag: 'meta', attrs: { property: 'og:image', content: `${SITE_URL}/og.png` } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE_URL}/og.png` } },
      ],
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
      // props and offers no slot, so the override is a copy of it. The site title is
      // the wordmark. The head override adds the two tags that mirror the page.
      components: {
        Head: './src/components/overrides/Head.astro',
        Header: './src/components/overrides/Header.astro',
        SiteTitle: './src/components/overrides/SiteTitle.astro',
      },
      // The pages and their categories are in `src/site-nav.ts`, which the agent files
      // at /llms.txt and /llms-full.txt section by the same groups. The sidebar is
      // explicit so URLs stay flat.
      sidebar: starlightSidebar(),
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
        // needs no prior `pnpm --filter sg-widgets-core build`, and `astro dev`
        // hot-reloads an edit to packages/core straight into the open demo page,
        // which watching a build output does not.
        // The mock site is a second entry point, so it is aliased before the root one:
        // these are prefix matches and `sg-widgets-core` would otherwise swallow it.
        { find: 'sg-widgets-core/mock', replacement: coreMockSrc },
        { find: 'sg-widgets-core', replacement: coreSrc },
        // A demo that builds a widget out of a registry part imports the same
        // primitive the part does. The site keeps no copy of either, so both point at
        // the workspace package's, which is also the copy the registry sources load:
        // one instance of each primitive on the page, and one combobox context.
        { find: '@base-ui/react', replacement: baseUi },
        { find: 'bits-ui', replacement: bitsUi },
        // The icons every registry item carries, so a demo of a part draws the same
        // glyphs the widgets do. The subpath entry comes first: the Svelte package
        // serves `@lucide/svelte/icons/<name>` out of its own `dist`.
        { find: '@lucide/svelte/icons', replacement: `${lucideSvelte}/dist/icons` },
        { find: '@lucide/svelte', replacement: lucideSvelte },
        { find: 'lucide-react', replacement: lucideReact },
        { find: '@', replacement: reactSrc },
        { find: '$lib', replacement: svelteLib },
      ],
      // The workspace packages carry their own react/svelte; keep one copy each so
      // hooks and runes work across the island boundary.
      dedupe: ['react', 'react-dom', 'svelte'],
    },
  },
});
