# Registry conventions

Every widget ships twice: as a `shadcn` item for React and a `shadcn-svelte` item for Svelte.
The two CLIs rewrite import paths differently, and each only rewrites paths that match its own
convention. Get the source location wrong and the item installs with imports pointing at files
that are not there. These rules are verified end-to-end: both registries were built, served over
HTTP, and installed into a throwaway consumer project with the real CLIs.

## 1. Item names

One kebab-case name per widget, **identical in both registries**: `status-badge`, `entity-chip`,
`thumbnail`, `user-avatar`, `field-value`. A name is the URL, so it never changes once published.

Every item is `type: "registry:component"`, with one exception: a shadcn primitive this repo has
replaced ships as its own `registry:ui` item under the primitive's own name, so a consumer installing
a widget gets this repo's version rather than the upstream one. React's are `command` and `popover`;
Svelte's are `command`, `select` and `checkbox`. Every item that named the plain upstream name names
this registry's item instead. Files inside such an item are `type: "registry:ui"` so they install to
the consumer's `ui` alias, which is what `@/components/ui/<name>` and `$lib/components/ui/<name>`
rewrite to.

A primitive earns an item only when this repo's copy carries a decision of its own: an export
upstream does not have, a rule a widget is written against, a measured change made after the folder
was vendored. Class order is not a change, and neither is upstream's drift since — the icon
placeholder, a `calc()` written with underscores, a `cn-` hook, a renamed Tailwind variant. Those
primitives stay upstream's and are named plainly, so a consumer gets the version upstream maintains.

Files in a component item are `type: "registry:component"` too. A component item is one file, or a
`.svelte` file with the `.svelte.ts` module it imports beside it (`value-editor`). Both land flat at
the components alias, so the import between them keeps its alias path and the CLI rewrites it like
any other. The primitive items are the multi-file ones; §6 says where each kind lands.

A renamed widget keeps its old name as a deprecated item for one release: the old item holds a
module that re-exports the new one, names the new item as its only `registryDependencies` entry,
and says "Deprecated" in its description. Its docs page keeps its URL and points at the new one.

One item per registry, `sg-widgets`, is the whole set: it carries no file and names every other
item in `registryDependencies`, so a consumer installs everything in one command.

```sh
pnpm dlx shadcn@latest add https://sg-widgets.vercel.app/r/react/sg-widgets.json
pnpm dlx shadcn-svelte@latest add https://sg-widgets.vercel.app/r/svelte/sg-widgets.json
```

It is the first entry of each `registry.json` and a new item is added to its list in the same
change that adds the item.

## 2. Where the source lives

| | path on disk | imported in source as | installs to |
|---|---|---|---|
| React widget | `packages/react/src/registry/sg/components/<name>.tsx` (or `.ts`) | `@/registry/sg/components/<name>` | `<components alias>/<name>.tsx` |
| React primitive | `packages/react/src/components/ui/<name>.tsx` | `@/components/ui/<name>` | `<ui alias>/<name>.tsx` |
| Svelte widget | `packages/svelte/src/lib/registry/components/<name>.svelte` (or `.ts`, `.svelte.ts`) | `$lib/registry/components/<name>.svelte` | `<components alias>/<name>.svelte` |
| Svelte primitive | `packages/svelte/src/lib/components/ui/<name>/*` | `$lib/components/ui/<name>/index.js` | `<ui alias>/<name>/*` |

React: the `@/` prefix is this package's own tsconfig alias (`@/* → ./src/*`), which is why the
files sit under `src/`. The CLI rewrites by matching the **import string**, not the disk path:
`@/registry/<anything>/components/…` becomes the consumer's `components` alias, and
`@/lib/utils` becomes their `utils` alias. Bare specifiers (`sg-widgets-core`, `lucide-react`)
are never touched. The `components` segment matters twice over: it is what makes the import
rewrite land on `@/components/<name>` *and* what makes the install path collapse to
`<components>/<name>.tsx`. Drop it and the two disagree.

Svelte: shadcn-svelte does a literal string substitution at **build** time, turning the source
aliases `registry.json` names into placeholders, which `add` then expands into the consumer's
aliases. The substitution runs in the order `components`, `ui`, `hooks`, `utils`, `lib`, so a
longer alias is replaced before the `$lib` it starts with. The aliases are where each kind of file
lives in this package: `components` is `$lib/registry/components`, `ui` is `$lib/components/ui`,
`utils` is `$lib/utils`, and `hooks` and `lib` are `$lib/hooks` and `$lib`, so an import from either
is rewritten rather than copied verbatim. `files[].path` is read relative to the process cwd, so
`registry:build` must run from `packages/svelte`.

`registry.json` lives at each package root and `files[].path` is written relative to that root.

## 3. Dependencies between items

- **React** uses the item's absolute URL:
  `"registryDependencies": ["https://sg-widgets.vercel.app/r/react/entity-chip.json"]`. This is
  what makes the documented one-line install work with no edit to the consumer's
  `components.json`. The namespaced form (`@sg-widgets/entity-chip`) also resolves, but only after
  the consumer adds
  `"registries": { "@sg-widgets": "https://sg-widgets.vercel.app/r/react/{name}.json" }`, so it is
  not the default here. Never use a relative `./thing.json`: React reads that off the *consumer's*
  disk, not relative to the item's URL.

- **Svelte** has no namespaces in 1.x. Use `"registryDependencies": ["local:entity-chip"]`;
  `registry build` rewrites it to `"./entity-chip.json"`, which `add` resolves against the parent
  item's URL. The field is required, so items with no dependencies carry `[]`.

The trade-off is the same in both: a dependency is addressed by URL, so a registry served from a
different host resolves its own items only if that host is the one baked in. The Svelte form is
relative and therefore host-independent; React has no relative option that reaches the network.

The host is one literal, `sg-widgets.vercel.app`. It is spelled in both `registry.json` files,
`packages/react/components.json`, `tools/registry-check.mjs`, `apps/site/astro.config.mjs`,
`apps/site/src/components/Install.astro` and this file, and moving the registry to another domain
is that one rename, made everywhere in one change.

An item names the items its own files import, and only those. A dependency reached through another
item is not restated: `entity-table` names `collection-footer`, and `collection-footer` names
`select`. Anything from the upstream registries is referenced by its plain name (`"button"`) in
both; the `@shadcn/button` form is not used. A primitive this registry ships is named as this
registry's item (`https://sg-widgets.vercel.app/r/react/command.json`, `local:command`), never
plainly.

A Svelte widget may import a sibling widget by relative path (`./entity-picker.svelte`). Every
component item lands flat at the components alias, so the path survives install. The sibling's item
is still named in `registryDependencies`, which is what makes it install.

## 4. npm dependencies

An item declares every package its own files import, and nothing else. `sg-widgets-core` and the
icon package are named where a file imports them, and not where none does. `react`, `react-dom` and
`svelte` are never named. Two packages come in through what a file uses rather than what it imports:

- `lib/utils` is `cn` for React and `clsx` plus `tailwind-merge` for Svelte; an item that imports
  `lib/utils` names those.
- An item whose classes are `tw-animate-css`'s enter and exit animations names `tw-animate-css`.

`pnpm registry:check` (`tools/registry-check.mjs`) reads each `registry.json` against the files it
names and fails on any difference, in both directions and for `registryDependencies` as well.
`pnpm check` and `pnpm registry:build` run it first, so a registry that has drifted from its
sources neither passes nor builds.

shadcn-svelte auto-detects dependencies from the source imports whenever `dependencies` or
`devDependencies` is empty, and it classifies them by where they sit in `packages/svelte/package.json`.
Anything a registry item imports at runtime therefore belongs in that file's `dependencies`, not
its `devDependencies` — that is why `@lucide/svelte` moved.

## 5. Building

```
pnpm registry:build          # the check, then both packages
```

- React: `shadcn build --output ../../apps/site/public/r/react`, run from `packages/react`.
  Emits `<name>.json` per item plus a copy of `registry.json`. File contents are **verbatim**;
  React rewrites imports at `add` time.
- Svelte: `shadcn-svelte registry build --output ../../apps/site/public/r/svelte`, run from
  `packages/svelte`. Emits `<name>.json` per item plus `index.json`. File contents already carry
  the `$COMPONENTS$`, `$UI$` and `$UTILS$` placeholders, and `files[].path` is replaced by `target`.

The site serves both trees statically at `/r/react/<name>.json` and `/r/svelte/<name>.json`.

## 6. Traps

- A React item whose path has no `components` segment falls through to a rule that strips exactly
  one segment, so `@/registry/sg/<name>/<name>` rewrites to `@/components/<name>/<name>` while the
  file installs flat at `@/components/<name>.tsx`. Broken import, no error.
- A Svelte **single-file** `registry:ui` item installs to `<ui>/<file>` while a multi-file one
  installs to `<ui>/<item-name>/<file>`. The three primitive items are multi-file and land where
  `$lib/components/ui/<name>/index.js` expects them; every other item is `registry:component`, which
  always flattens to the alias root, two files or one.
- A source alias only becomes a placeholder if `registry.json` names it. The Svelte `ui` alias is
  `$lib/components/ui`, the folder the primitives live in, so `$UI$` reaches the consumer's own
  alias. Point it anywhere else and the import string survives the build verbatim and only works
  for a consumer whose alias happens to match.
- shadcn-svelte's `registry build` drops `docs` and `categories`; React keeps both.
- Item content is copied into the consumer's tree and edited by them. Nothing in an item may
  import from another package in this monorepo except `sg-widgets-core`.

## Dependency graph

`registryDependencies` must form a tree, never a cycle. Both CLIs hang on a cycle (measured:
an install against a registry where field-value depended on entity-chip, entity-chip on
entity-card and entity-card on field-value never returned). The atoms therefore flow one way:
field-value → entity-chip → entity-card → status-badge and thumbnail. A card draws its own
values rather than reaching back to FieldValue.
