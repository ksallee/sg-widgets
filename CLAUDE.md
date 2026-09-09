# sg-widgets

Monorepo: `packages/core` (headless TS, npm), `packages/react` (shadcn registry, Base UI), `packages/svelte` (shadcn-svelte registry, Bits UI, Svelte 5 runes), `apps/site` (Astro + Starlight, React and Svelte islands, serves both registries).

## Rules

- Framework-neutral logic goes in core: operator vocabularies, value shapes, filter serialisation, status subtraction, display-name fallback, the Project status-field exception, client calls. UI packages never inline a ShotGrid quirk.
- API behaviour comes from `~/dev/sg-groundtruth/corpus` (read `INDEX.md` first). Cite the probe or card in a comment when encoding a quirk. Do not guess REST behaviour.
- UI uses only shadcn tokens (`--background`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`, ...). Status colours come from site data and layer on top.
- Order per widget: core model + tests, then Svelte, then React. Both must exist before a widget is documented.
- Never copy code from `~/Downloads/some_files`. Ideas only.
- Pickers: server-side search, client filtering off. No data loading in effects with "last seen" guards; use a query/cache layer. Checkboxes for "which of these", chips only for ordered lists.
- Registry items: React under `packages/react/registry/sg/<name>/`, Svelte under `packages/svelte/registry/<name>/`. `pnpm registry:build` emits to `apps/site/public/r/{react,svelte}`.

## Commands

    pnpm test / pnpm check / pnpm build / pnpm registry:build / pnpm dev:site
