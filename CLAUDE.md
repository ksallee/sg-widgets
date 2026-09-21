# sg-widgets

Monorepo: `packages/core` (headless TS, npm), `packages/react` (shadcn registry, Base UI), `packages/svelte` (shadcn-svelte registry, Bits UI, Svelte 5 runes), `apps/site` (Astro + Starlight, React and Svelte islands, serves both registries).

## Rules

- Framework-neutral logic goes in core: operator vocabularies, value shapes, filter serialisation, status subtraction, display-name fallback, the Project status-field exception, client calls. UI packages never inline a ShotGrid quirk.
- API behaviour comes from `~/dev/sg-groundtruth/corpus` (read `INDEX.md` first). Cite the probe or card in a comment when encoding a quirk. Do not guess REST behaviour.
- Follow `docs/design-rules.md` (spacing scale, parents own gaps, motion, states).
- No new runtime dependency. The base is the shadcn primitives on Bits UI (Svelte) and Base UI (React), plus TanStack Table and Virtual; everything else is written in this repo. Ecosystem components (ReUI, Dice UI, shadcn's own examples, headless-tree, Zag) are read as reference implementations, never installed into a widget; the docs page names the reference and its version.
- UI uses only shadcn tokens (`--background`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`, ...). Status colours come from site data and layer on top.
- Order per widget: core model + tests, then Svelte, then React. Both must exist before a widget is documented.
- Never copy code from `~/Downloads/some_files`. Ideas only.
- Svelte popovers, selects and dialogs that hold a Command list use `strategy="fixed"` on their content, are controlled with a function binding on `open`, and focus their input in `onOpenAutoFocus` with `preventScroll`; never the `autofocus` attribute. Any `.focus()` call passes `{ preventScroll: true }`.
- Pickers: server-side search, client filtering off. No data loading in effects with "last seen" guards; use a query/cache layer. Checkboxes for "which of these", chips only for ordered lists.
- A new widget page is added to its category in `apps/site/src/site-nav.ts` (Foundations, Display, Pickers, Queries and collections), which the sidebar, `/llms.txt` and `/llms-full.txt` are all built from; the sidebar is explicit so URLs stay flat.
- Registry conventions are in `docs/registry-conventions.md` (React items in `packages/react/src/registry/sg/components/<name>.tsx`, Svelte in `packages/svelte/src/lib/registry/components/<name>.svelte`, same kebab name in both). `pnpm registry:build` emits to `apps/site/public/r/{react,svelte}`.

## Process

- A change starts as a short issue: one paragraph, edited in place when scope changes.
- Branch from `dev` (`feat/<issue>-slug`, `fix/slug`). PR onto `dev`, squash-merged, once
  `pnpm check` and `pnpm test` are green. Merging needs Kevin's say in the session.
- `main` is promoted by a PR from `dev`, merge commit, after Kevin QAs `dev`.
- The failing test lands first, in the same commit as the code that makes it pass. Docs and
  CSS-only changes carry screenshots instead.

## Verifying UI

- Use `pnpm qa` (`tools/qa.mjs`) to drive the docs site headless: `--start` launches an isolated dev
  server, `--path` picks the page, `--drive file.js` runs an async body in the page and prints its
  return as JSON, `--shot out.png` screenshots, `--dark`, `--reduced-motion`, `--framework svelte|react|both`.
  Do not use the Playwright MCP tools for this repo. Every UI PR includes one screenshot per
  framework taken with it, in light and dark.
- Drive scripts that assert return `{ verdict: "PASS ..." | "FAIL ..." }`; the exit code follows.
- A widget that reads data runs its final `pnpm qa` pass once with `--live` as well as against the
  mock, and the PR says what the live site showed.
- `pnpm qa` comes last, not first. Read the code to learn the current state; never start a
  browser to discover how something looks or behaves before writing the change. Write the change,
  get `pnpm check` and `pnpm test` green, then run `pnpm qa` once to confirm (one drive with
  assertions, one light and one dark shot per widget). If the drive fails, fix from the drive's
  output and rerun; do not screenshot between fixes. Read a screenshot image only when a drive
  verdict cannot answer the question. Each run costs a dev server start and tokens.

## Writing

Follow `docs/writing-rules.md` for docs pages, comments, issues and PRs.

## Commands

    pnpm test / pnpm check / pnpm build / pnpm registry:build / pnpm dev:site / pnpm qa
