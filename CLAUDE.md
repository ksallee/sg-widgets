# sg-widgets

Monorepo: `packages/core` (headless TS, npm), `packages/react` (shadcn registry, Base UI), `packages/svelte` (shadcn-svelte registry, Bits UI, Svelte 5 runes), `apps/site` (Astro + Starlight, React and Svelte islands, serves both registries).

## Rules

- Framework-neutral logic goes in core: operator vocabularies, value shapes, filter serialisation, status subtraction, display-name fallback, the Project status-field exception, client calls. UI packages never inline a ShotGrid quirk.
- API behaviour comes from `~/dev/sg-groundtruth/corpus` (read `INDEX.md` first). Cite the probe or card in a comment when encoding a quirk. Do not guess REST behaviour.
- Follow `docs/design-rules.md` (spacing scale, parents own gaps, motion, states). Reuse shadcn and community registry items before hand-rolling a control.
- UI uses only shadcn tokens (`--background`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`, ...). Status colours come from site data and layer on top.
- Order per widget: core model + tests, then Svelte, then React. Both must exist before a widget is documented.
- Never copy code from `~/Downloads/some_files`. Ideas only.
- Pickers: server-side search, client filtering off. No data loading in effects with "last seen" guards; use a query/cache layer. Checkboxes for "which of these", chips only for ordered lists.
- Registry conventions are in `docs/registry-conventions.md` (React items in `packages/react/src/registry/sg/components/<name>.tsx`, Svelte in `packages/svelte/src/lib/registry/components/<name>.svelte`, same kebab name in both). `pnpm registry:build` emits to `apps/site/public/r/{react,svelte}`.

## Verifying UI

- Use `pnpm qa` (`tools/qa.mjs`) to drive the docs site headless: `--start` launches an isolated dev
  server, `--path` picks the page, `--drive file.js` runs an async body in the page and prints its
  return as JSON, `--shot out.png` screenshots, `--dark`, `--reduced-motion`, `--framework svelte|react|both`.
  Do not use the Playwright MCP tools for this repo. Every UI PR includes one screenshot per
  framework taken with it, in light and dark.
- Drive scripts that assert return `{ verdict: "PASS ..." | "FAIL ..." }`; the exit code follows.

## Writing

Follow `docs/writing-rules.md` for docs pages, comments, issues and PRs.

## Commands

    pnpm test / pnpm check / pnpm build / pnpm registry:build / pnpm dev:site / pnpm qa
