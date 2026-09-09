// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [
    starlight({
      title: 'sg-widgets',
      description: 'shadcn-compatible widgets for Flow Production Tracking, for React and Svelte.',
      sidebar: [
        { label: 'Start', items: [{ label: 'Introduction', slug: 'start/introduction' }] },
        { label: 'Widgets', autogenerate: { directory: 'widgets' } },
        { label: 'Core', autogenerate: { directory: 'core' } },
      ],
    }),
    react(),
    svelte(),
  ],
  vite: { plugins: [tailwindcss()] },
});
