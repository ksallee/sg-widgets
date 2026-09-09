# Design rules

These rules bind every widget in both frameworks. A PR that breaks one is not mergeable.
The goal is one system: a page mixing ten of our widgets must read as one hand.

## 1. Tokens only

- Colours, radius, fonts and shadows come from shadcn tokens (`bg-background`, `text-muted-foreground`,
  `border-border`, `ring-ring`, `rounded-md` via `--radius`, ...). Never a raw hex, rgb or arbitrary
  colour class. The exceptions are colour that is data: status colour from the site through `parseBgColor`, and the
  name-derived hue behind initials, both applied inline.
- Never override a shadcn primitive's look from outside. Compose it, or pass `className`/`class`.
- Both frameworks must produce the same DOM structure and the same classes for the same widget. When in
  doubt, write the Svelte one first and port the markup verbatim.

## 2. Spacing

- Parents own the gap. A flex or grid container sets `gap-*`; children never carry `m*`, `mt-*`, `ml-*`
  to space themselves from siblings. If you reach for a margin, you are missing a container.
- Padding belongs to the surface that has a border or background, not to its content.
- One scale, used everywhere:

  | role | class |
  |---|---|
  | between inline glyph and its text (icon + label) | `gap-1.5` |
  | between items in a row or list | `gap-2` |
  | between sections inside a card or popover | `gap-3` |
  | between stacked form fields | `gap-4` |
  | popover / card / dialog padding | `p-3` (compact), `p-4` (default) |
  | list row padding | `px-2 py-1.5` |
  | table cell padding | `px-3 py-2` |

- Density is a prop on collections (`density: "compact" | "default"`), never a global. Compact halves the
  vertical padding only.
- Alignment: every row is `flex items-center`; multi-line rows are `flex items-start` with a fixed-size
  leading slot (thumbnail, avatar, checkbox) so text always starts at the same x.
- Truncation: single-line text gets `truncate min-w-0` and a `title` attribute with the full value.
  Never let a widget grow past its container horizontally.

## 3. Sizes

- Controls come in `sm`, `md` (default), `lg`, matching shadcn's button and input heights (`h-8`, `h-9`,
  `h-10`). Icons inside controls are `size-4` for sm/md and `size-5` for lg. Thumbnails in list rows are
  `size-6` (sm), `size-8` (md), `size-10` (lg); cards and detail panes use `xl` (h-16) and `2xl` (h-24).
  Avatars follow the first three sizes.
- Width is the caller's business: widgets are `w-full` by default and never set a fixed width. A caller
  wraps in a sized container.

## 4. Motion

Motion explains a change; it never decorates. Every animated property must answer "what did this movement
tell the user".

- Durations: `duration-150` for hover/press/focus feedback, `duration-200` for popovers, menus and
  chips entering or leaving, `duration-300` only for large surfaces (dialogs, sheets, expanding panels).
  Nothing over 300ms.
- Easing: enter with `ease-out`, exit with `ease-in`, hover with the default. Never linear.
- Animate only `opacity`, `transform` (translate, scale) and `height` via CSS grid or the `tw-animate-css`
  helpers. Never animate `width`, `margin`, `padding` or `top/left`.
- Popovers: fade plus a 4px slide from the anchor side and a `scale-95` to `scale-100`. Use the shadcn
  primitive's built-in data-state animations; do not add your own.
- Lists: an item appearing (search results, chips added) fades in over 150ms; an item removed fades and
  collapses over 200ms. Reordering (drag) moves with `transition-transform duration-200`.
- Loading: never a spinner for the first 150ms. Skeletons (`Skeleton` primitive) shaped like the content
  they replace; a spinner only inside a control that is busy (a submit button, a combobox fetching).
- Hover and press: background change on `duration-150`; press scales to `active:scale-[0.98]` on buttons
  and chips only.
- Respect `prefers-reduced-motion`: all transitions collapse to opacity-only. Use the `motion-safe:` /
  `motion-reduce:` variants. Test it once per widget.
- No motion on initial page render of static content.

## 5. States, in this order of precedence

`disabled` > `readonly` > `invalid` > `focus-visible` > `hover` > `selected`.

- Focus: `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`, never `outline-none`
  without a ring replacement. Focus rings are the shadcn ones, unchanged.
- Disabled: `opacity-50 pointer-events-none`, plus `aria-disabled`. Readonly keeps full contrast and
  removes affordances (no chevron, no clear button).
- Invalid: `aria-invalid` and the shadcn `aria-invalid:` ring/border classes, plus room for a message the
  caller renders.
- Selected rows: `bg-accent text-accent-foreground`. Highlighted (keyboard cursor) uses the same, never a
  second colour.
- Empty, loading and error states are part of every data widget and are visually consistent: a centred
  `text-sm text-muted-foreground` line with a `size-4` icon, `py-6` inside popovers, `py-10` in tables.

## 6. Typography

- Body `text-sm`. Sub-labels and metadata `text-xs text-muted-foreground`. Ids and codes
  `font-mono text-xs tabular-nums`. Never `text-[13px]` style arbitrary sizes.
- Numbers right-aligned with `tabular-nums`. Dates left-aligned.
- One weight step for emphasis (`font-medium`). Matched search runs are `font-semibold`, not colour.

## 7. Composition and reuse

- Before building a control, look for it: shadcn's own registry first (combobox, command, popover,
  select, calendar, data-table, skeleton, toggle-group, sonner...), then community registries known
  for quality (Origin UI for inputs and selects, Kibo UI for heavier application components, the
  shadcn.io and shadcnblocks catalogues for variants). For Svelte, shadcn-svelte's registry and Bits UI
  recipes. Prefer an item you can install into `components/ui` and compose over a hand-rolled control.
  Record the source in the item's docs page.
- A widget exposes slots/snippets for the parts callers will want to change: option row, selected
  item, empty state. Everything else is fixed.
- Keyboard first: every widget is operable without a mouse, and the keyboard model is documented on its
  docs page in one short table.

## 8. Checklist for a PR

1. No margins on flex or grid children.
2. Only the spacing scale above.
3. Tokens only, no raw colours.
4. Motion on opacity/transform only, 150/200/300, reduced-motion tested.
5. Same DOM and classes in both frameworks.
6. Empty, loading, error states present and consistent.
7. Focus rings intact, keyboard documented.
8. `w-full` default, truncation with title.

## 9. Row anatomy and its props

Every widget that lists entity rows (pickers, search, grouped list, grid cards, tree, table cells
that show an entity) draws the same row and takes the same props to shape it, so a caller learns
them once:

| prop | meaning | default |
|---|---|---|
| `thumbnail` | `false`, or the image field name (`'image'`) | `'image'` in pickers and search, `false` in dense lists |
| `labelField` | the field shown as the main label | the display-name chain in core |
| `subLabelField` / `subLabel(row)` | the muted line under the label | the entity type when several types are shown, else none |
| `secondaryField` / `secondary(row)` | the right-aligned column, rendered by data type through FieldValue | none |
| `showCode` | show programmatic names beside display names where the row is a field or a type | `false` |
| `fields` | extra fields to request so a caller's own sub-label or secondary can read them | `[]` |

A widget may add props of its own, but never a second spelling for one of these. Presets (user,
project) are configurations of these props, not forks.
