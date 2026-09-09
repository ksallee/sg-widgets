# sg-widgets

shadcn-compatible widgets for Flow Production Tracking (ShotGrid), for React and Svelte.

| package | what |
|---|---|
| `packages/core` | `@sg-widgets/core`: headless TypeScript. Field data types and operator vocabularies, filter tree to `api3_hash`, status logic, client adapter. No framework, no dependencies. |
| `packages/react` | shadcn registry on Base UI. Installed into your app with `shadcn add`. |
| `packages/svelte` | shadcn-svelte registry on Bits UI, Svelte 5. Installed with `shadcn-svelte add`. |
| `apps/site` | Astro + Starlight docs, live demos of both frameworks side by side, and the static registry JSON under `/r/react` and `/r/svelte`. |

The behaviour the core encodes comes from [sg-groundtruth](https://github.com/ksallee/sg-groundtruth), a recorded corpus of what the REST API actually does.

## Develop

    pnpm install
    pnpm test              # core unit tests
    pnpm check             # typecheck every package
    pnpm registry:build    # emit registry JSON into apps/site/public/r
    pnpm dev:site          # docs and demos

## Build order

Every widget lands in core first (model, tests), then Svelte, then React. A widget is done when both frameworks have it.
