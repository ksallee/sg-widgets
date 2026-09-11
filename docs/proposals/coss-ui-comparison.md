# coss.com/ui compared against the widgets

coss.com/ui is a public React component registry published by the company behind Cal.com. It is
shadcn-shaped: copy-in source files, Tailwind v4, shadcn CSS variables, one item per component,
installed with the shadcn CLI. Every primitive sits on Base UI; there is no Radix and no cmdk. The
source read here is the repository `cosscom/coss` at commit `e937bec` (2026-09-08), 54 items under
`apps/ui/registry/default/ui`, read on 2026-09-11. It pins `@base-ui/react` at 1.8.0 and
`@daypicker/react` at 10.0.1; this repo pins `^1.8.0` and `^10.0.1` of the same two. Nothing in
their source uses a Base UI part this repo cannot already call. Nothing here is installed or copied;
this is a reading of their source against ours.

## Take

Ranked. Each line says what it would touch and whether the Svelte registry needs its own work.

1. Build the React `Command` on Base UI Autocomplete rather than cmdk. Their `command.tsx` is a
   thin preset over `autocomplete.tsx` with `inline`, `open` and `keepHighlight`, which drops a
   runtime dependency and puts the five React widgets that use Command on the same list engine as
   `picker-control`. React only: the Svelte side already runs on Bits UI Command, and the DOM
   difference recorded in `hierarchical-search.tsx` disappears with it.
2. Wrap the popup list in a scroll area with edge fade masks and a scrollbar gutter, so a list that
   scrolls says so. Touches `picker-control` in both registries; Base UI publishes the overflow
   distances as CSS variables, Bits UI does not, so Svelte needs its own measurement.
3. Give the list row a two-column grid with a fixed indicator column. The label sits at one x
   whether or not a row is ticked, and a multi picker stops shifting its text as rows are chosen.
   Both registries: `picker-classes` and `picker-row`.
4. Announce the list's state in a live region. Base UI's `Combobox.Status` is an `aria-live` row
   carrying "Searching…", a result count, or the error. Both registries; Svelte needs a plain
   `aria-live` element.
5. Take the chip keyboard model from Base UI's chips: Left and Right move focus across chips,
   Backspace or Delete removes the focused one and moves to a sensible neighbour, Enter, Space and
   any printable key return to the input, Down opens the list. This repo's model arms only the last
   chip. React can adopt the primitive; Svelte would carry the model in core and implement roving
   focus itself.
6. Enlarge touch targets without changing layout, with a `pointer-coarse` pseudo-element that
   carries a minimum 44px box over a smaller control. Touches every icon control: the clear and open
   controls in `picker-classes`, the remove control in `leaf-classes`. Both registries, one class
   string each.
7. Use Base UI's `Popover.Viewport` to size and cross-fade a popover whose content is replaced.
   Applies to the drill-down in `hierarchical-search` and the operator and value swap in
   `filter-editor`. React only: Bits UI has no equivalent part.
8. Add one registry item that lists every other item as a dependency, so a consumer installs the
   whole set with one command. Both registries; the Svelte form is `local:` names.

## Per component

### Combobox and the picker base

Their combobox is a set of thin wrappers over Base UI parts, one exported function per part, each
carrying a `data-slot` and nothing else. There is no controller: open state, filtering, chips and
highlight all stay in the primitive. A React context holds one thing, a ref to the chips container,
so the popup can anchor to the whole field rather than to the input. This repo anchors the same way,
with a ref passed to the positioner.

Two differences in composition matter.

They use `Combobox.Chips`, `Combobox.Chip` and `Combobox.ChipRemove`. This repo draws chips itself
and measures them. The primitive's chips carry a roving tabindex and the key model in the Take
above. The measured overflow row here is the thing the primitive does not have: their chips wrap to
a second line and grow the field, with no `+n`.

They use `Combobox.Status`, `Combobox.Empty` and `Combobox.Collection`. This repo draws the empty
and error line itself through `state-line` and passes `null` as the filter, which is the same
server-side search decision. `Status` is the piece with no counterpart here: an `aria-live` row the
async demo fills with "Searching addresses…", a count, or an error string.

| | theirs | ours |
|---|---|---|
| base | `apps/ui/registry/default/ui/combobox.tsx` | `packages/react/src/registry/sg/components/picker-control.tsx` |
| | | `packages/svelte/src/lib/registry/components/picker-control.svelte` |
| row | `apps/ui/registry/default/ui/combobox.tsx` | `packages/react/src/registry/sg/components/picker-row.tsx` |
| classes | inline per part | `packages/react/src/registry/sg/components/picker-classes.ts` |

States are expressed on data attributes from the primitive: `data-highlighted`, `data-disabled`,
`data-pressed`, `data-checked`, `data-starting-style`, `data-ending-style`, plus `aria-invalid` for
the invalid ring. This repo uses the same attributes, with `data-invalid` and `data-readonly` added
where the primitive has no state for it.

Their focus treatment is a border swap plus a 3px ring at 24% of the ring colour, applied to the
field through `has-focus-visible:`. This repo uses the shadcn ring: `ring-2` with a 2px offset. The
two cannot be mixed; rule 5 of the design rules settles it in this repo's favour.

Sizes are `sm`, `default`, `lg` with a second step at the `sm` breakpoint, so a control is one step
taller on a phone. This repo has one ladder at 8, 9, 10.

### Autocomplete and Command

Their `command.tsx` sets three props on Autocomplete and adds a dialog shell:

```tsx
<Autocomplete autoHighlight="always" inline keepHighlight open {...props} />
```

The list, the item, the group and the empty state are the autocomplete's, restyled. The dialog shell
adds a viewport, a backdrop with a blur, a panel that clips its own border, and a footer row for
shortcut hints. There is no cmdk, no second highlight model and no second set of `data-` attributes.

This repo runs two list engines in React. `picker-control` is Base UI Combobox; `global-search`,
`hierarchical-search`, `field-picker`, `filter-bar` and `column-picker` are cmdk through
`packages/react/src/components/ui/command.tsx`. The Svelte registry runs Bits UI Command in the same
five widgets. A comment at `packages/react/src/registry/sg/components/hierarchical-search.tsx:361`
records one consequence: cmdk marks an unselected row `data-selected="false"` where Bits UI omits the
attribute. Rule 1 of the design rules asks for the same DOM in both frameworks, and moving React off
cmdk removes that whole class of divergence along with a dependency.

### Select

They keep Base UI's `alignItemWithTrigger`, so the chosen item opens over the trigger, and they
render `Select.ScrollUpArrow` and `Select.ScrollDownArrow` as gradient-masked rows at the top and
bottom of a long list. The item is the two-column grid described above.

They also export a `SelectButton` that is only the trigger's look, meant to be passed to another
primitive's trigger through `render`. A combobox can therefore wear a select's face without a second
component. This repo's equivalent decision is that a picker is never built from the primitive; the
same effect is a prop on `picker-control`.

### Popover, dialog and tooltip

Their popover and tooltip both render `Popup` around a `Viewport`. The viewport is what makes a
popover whose content changes resize and cross-fade: the outgoing and incoming children carry
`data-previous` and `data-current`, and the popup animates `width`, `height`, `scale` and `opacity`.
The positioner carries a transition on `top`, `left`, `right`, `bottom` and `transform`, and Base UI
sets `data-instant` when a move must not animate.

Their dialog uses `Dialog.Viewport`, a full-screen grid of `1fr auto 3fr`, so the popup sits above
optical centre, and at phone widths it becomes a bottom sheet by changing the grid. Nested dialogs
read `--nested-dialogs` to scale and fade the stack behind.

This repo centres the dialog with `top-1/2 left-1/2` and a translate, at
`packages/react/src/components/ui/dialog.tsx`, and animates with the tw-animate-css helpers
(`data-open:animate-in`, `data-closed:animate-out`) at `duration-100`. Theirs uses Base UI's own
`data-starting-style` and `data-ending-style` with a plain `transition-[scale,opacity]` at
`duration-200`, which is the number rule 4 of the design rules asks for.

| | theirs | ours |
|---|---|---|
| popover | `apps/ui/registry/default/ui/popover.tsx` | `packages/react/src/components/ui/popover.tsx` |
| dialog | `apps/ui/registry/default/ui/dialog.tsx` | `packages/react/src/components/ui/dialog.tsx` |
| tooltip | `apps/ui/registry/default/ui/tooltip.tsx` | none; `hover-card` is the nearest |

### Scroll area

Their scroll area takes four booleans: `scrollFade`, `scrollbarGutter`, `fill` and
`overscrollContain`. The fade is a CSS mask driven by the variables Base UI sets on the viewport,
so the top edge fades only when there is content above and the bottom only when there is content
below. The scrollbar is 6px, fades in on hover or scroll after a 300ms delay, and reserves its
gutter only when the content overflows. The combobox list, the autocomplete list and the dialog
panel all sit inside it.

This repo's list is `no-scrollbar … overflow-y-auto` in `picker-classes.ts`, with no edge treatment.
The fade is the part worth taking: a list clipped mid-row reads as finished.

### Chips, badges and remove controls

Their chip is a flat row with a remove control that changes opacity on hover. Their badge has eight
variants, three of them semantic (`success`, `warning`, `info`, `error`) built on token pairs such
as `--success` and `--success-foreground` at 8% and 16%.

This repo's remove control washes with its own foreground at 15% rather than the destructive tint,
so a chip's cross and a status badge's cross read the same. That is the better rule and it is
already written down. What is missing is the semantic token pair: this repo has `--destructive` and
nothing for success, warning or info, so a widget that needs a warning tone has no token to reach
for.

| | theirs | ours |
|---|---|---|
| chip | `apps/ui/registry/default/ui/combobox.tsx` | `packages/react/src/registry/sg/components/entity-chip.tsx` |
| badge | `apps/ui/registry/default/ui/badge.tsx` | `packages/react/src/registry/sg/components/status-badge.tsx` |
| remove | `apps/ui/registry/default/ui/combobox.tsx` | `packages/react/src/registry/sg/components/leaf-classes.ts` |

### Input, input group and field

Their input is an outer `span` carrying the box and an inner input carrying the text, so an addon,
a trigger and a clear control can sit inside one border without the input's own padding fighting
them. The addon sets focus to the input on a press that did not land on something interactive.

Their `Field` is Base UI's field: root, label, description, error, control, validity. The error row
appears from the primitive's validity state rather than from a prop.

This repo has `field-error` and the editors, which cover the same ground for cell editing rather
than for forms. `packages/react/src/components/ui/input-group.tsx` is the shadcn item and is used by
the cmdk command input.

### Number field

Base UI's number field gives a scrub area: the label is draggable left and right to change the
value, with a custom cursor drawn while the pointer is locked. Their wrapper puts decrement and
increment buttons at the two ends of the group and the input, `tabular-nums` and centred, between
them.

This repo's `number-editor` is a text input with parsing and clamping in core. The scrub area is the
one idea here; it is a Base UI part, so React gets it for free and Bits UI has no counterpart.

### Table

Their table is markup only: a container with `overflow-x-auto`, a `card` variant that separates
borders and rounds the four outer corners of the body, and hover and selected colours mixed from
`--card` with 2% and 4% black or white. There is no data layer; TanStack Table v9 is used in the
demos.

This repo's `entity-table` carries sorting, resizing, pinning, grouping, virtualisation past 100
rows, a sticky header, a per-column menu and density, all on TanStack Table v9. Nothing in their
table is a gap here. The `card` variant is a look worth noting for `entity-grid`, not for the table.

### Tabs, toggle group and segmented control

They factor a segmented control into three exported class strings at
`apps/ui/registry/default/lib/segmented-control.ts`, then use them from tabs, from a toggle group
and from a nav, with a `state` variant that picks which attribute reads as selected: `data-checked`,
`data-pressed` or `aria-current`. One look, three primitives, no fourth component.

Their tabs use `Tabs.Indicator` with the `--active-tab-width`, `--active-tab-height` and
`--active-tab-left` variables and a 200ms transition on width and translate.

This repo's nearest structures are `control-classes.ts`, `leaf-classes.ts` and `picker-classes.ts`,
which already do this for controls, leaf atoms and pickers. The segmented-control file is the same
idea applied to a look rather than a ladder.

### Toolbar, group and empty

Their `Group` joins adjacent controls into one bordered run by stripping the inner radii and borders
with sibling selectors, and their `GroupSeparator` turns the seam the colour of the focus ring when
either neighbour has focus. That last detail is the interesting one: the seam belongs to whichever
control is focused.

Their `Empty` is a six-part block: root, header, media, title, description, content. The `icon`
media variant draws two rotated ghost copies behind the real tile, so an empty state reads as a
stack of nothing.

This repo's `state-line` is one row: an icon, a line, and an optional child, with `py-6` in popovers
and `py-10` in tables. That is the right size for a popup list. A page-level empty state has no
counterpart here, and `entity-grid` and `entity-table` would be the callers.

### Avatar, skeleton and spinner

Their avatar is Base UI's, with the image hidden on `data-loading` and `data-error` so the fallback
never flashes. Their skeleton is a fixed background-position sweep on a linear gradient over
`--color-muted`, driven by a `--animate-skeleton` theme token, with the highlight colour swapped in
dark. Their spinner is one lucide icon with `role="status"` and an accessible name.

This repo's `user-avatar` derives a hue from the name for the initials fallback, which theirs does
not do. The skeleton is the shadcn pulse. Their sweep is a look, not a fix.

### Docs conventions

Every component page is: frontmatter with a title, a one-line description and a link to the matching
Base UI API page; a preview; an install block with CLI and manual tabs; a usage section with import
and composition snippets; an API reference with one table per exported part; then a list of numbered
examples. Demos are separate files named `p-<component>-<n>.tsx`, each exporting a function named
`Particle` and nothing else, so a demo can be embedded, listed and shipped as registry source without
a wrapper.

Two conventions this repo does not have. First, the API reference is one table per part rather than
one table per component, which is what a part-based API needs. Second, they ship an agent skill
alongside the docs: per-primitive reference files with "when to use", "when not to use", canonical
imports, a minimal pattern, common pitfalls and pointers to numbered demos.

Theming is shadcn's variable set plus `--info`, `--success`, `--warning` and a `-foreground` for
each, plus `--code`, `--code-foreground`, `--code-highlight` for the docs site. Values are written as
`color-mix` and `--alpha` over Tailwind's palette variables rather than as hex, so one change to
`--background` moves the card, popover and sidebar with it.

## Already covered

- Server-side search with client filtering off. Their async demo reaches the same shape:
  `filter={null}`, a debounce, an abort, and the rows straight from the response.
- The `+n` overflow row. Their chips wrap and grow the field; the measured row here is strictly
  more.
- A load-more row inside the list, and the rule that pressing it is not a selection.
- Status colour as data layered over tokens.
- Tree keyboard: Up, Down, Left, Right, Home, End, `*`, Space and Enter, in core. They have no tree.
- Table: sorting, resizing, pinning, grouping, virtualisation, sticky header, density. Theirs is
  markup.
- Skeletons shaped like the rows they replace, in `search-skeleton`.
- Fixed positioning for picker popups, so a popup in a scrolled container stays with its anchor.
- The precedence order of states, and the remove control's foreground wash.
- One row component reused by every widget that lists entities.
- Reduced motion as a rule across every widget. They handle it for four toast keyframes only.

## Not applicable

- `useRender` and `mergeProps`. Their render-prop pattern is React-shaped; Bits UI uses child
  snippets with a different contract, so adopting it would split the two registries' APIs.
- `Combobox.Chips`, `Combobox.Chip`, `Combobox.ChipRemove`, `Combobox.Status`, `Combobox.Row` and
  `Combobox.Collection`. Bits UI's combobox exports root, input, trigger, content, item, group,
  group heading, viewport and the two scroll buttons, and nothing else. Any of these is React-only
  unless the behaviour moves into core and Svelte draws it by hand.
- `Dialog.Viewport` and `Popover.Viewport`. No Bits UI equivalent.
- Arbitrary values. Their source is built on `opacity-64`, `h-8.5`, `shadow-[0_1px_--theme(...)]`
  and `text-[.625rem]`. Rules 1 and 6 of the design rules rule all of that out here.
- The inset hairline border: a `before:` pseudo-element carrying a 4% black or 6% white shadow under
  every bordered surface. It is a raw colour by construction.
- Two-step responsive sizing, where every control is one step taller below the `sm` breakpoint. Rule
  3 fixes one ladder.
- Sidebar, drawer, toast, sheet, OTP field, meter and breadcrumb. No counterpart here and none
  wanted.
- `@hugeicons/react` and `@remixicon/react`, which their demos use beside lucide.
