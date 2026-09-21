import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The agent endpoints read the docs collection. Vitest has no Astro around it, so the
// module they read it through is the stub, which walks `src/content/docs` on disk.
export default defineConfig({
  resolve: {
    alias: {
      'astro:content': fileURLToPath(new URL('./test/stubs/astro-content.ts', import.meta.url)),
    },
  },
});
