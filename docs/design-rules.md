# Design rules

These rules bind every widget in both frameworks. A PR that breaks one is not mergeable.
The goal is one system: a page mixing ten of our widgets must read as one hand.

## 1. Tokens only

- Colours, radius, fonts and shadows come from shadcn tokens (`bg-background`, `text-muted-foreground`,
  `border-border`, `ring-ring`, `rounded-md` via `--radius`, ...). Never a raw hex, rgb or arbitrary
  colour class. The exceptions are colour that is data: status colour from the site through `parseBgColor`, and the
  name-derived hue behind initials, both applied inline.
- A surface takes the token its role names: a raised or bordered container that reads as a card is
  `bg-card text-card-foreground`; a floating surface - popover, dropdown, dialog, hover card, tooltip,
  command palette - is `bg-popover text-popover-foreground`, which the primitives already give; an
  inline region in the page flow - an input, a picker control, a table, a tree, an inline editor -
  stays `bg-background`; a tinted region stays `bg-muted` or `bg-accent`. A leaf that is put on one of
  them, a badge or a chip, paints no background of its own and wears the surface it sits on. On a
  palette whose card, popover and background differ, Bubblegum for one, a wrong token shows at once.
- Never override a shadcn primitive's look from outside. Compose it, or pass `className`/`class`.
- Both frameworks must produce the same DOM structure and the same classes for the same widget. When in
  doubt, write the Svelte one first and port the markup verbatim.

## 2. Spacing

- Parents own the gap. A flex or grid container sets `gap-*`; children never carry `m*`, `mt-*`, `ml-*`
  to space themselves from siblings. If you reach for a margin, you are missing a container.
- A parent owns a zero gap too. A list of rows is a flex column with no gap, as every popup list is,
  so hover, drop-target and dragging fills run edge to edge. `gap-2` is for items in a row - chips,
  buttons, a glyph and its text - never for rows in a list.
- Padding belongs to the surface that has a border or background, not to its content. A row's padding
  is the inset of its own surface, never spacing between rows.
- The height ladder of rule 3 is for controls. A row's height follows its content, and `size` moves a
  row's text and its glyphs, as it does in the pickers.
- Skeletons stand in for rows: same inset, same height, same zero gap, so a list holds its place when
  data lands.
- One scale, used everywhere:

  | role | class |
  |---|---|
  | between inline glyph and its text (icon + label) | `gap-1.5` |
  | between items in a row or list | `gap-2` |
  | between sections inside a card or popover | `gap-3` |
  | between stacked form fields | `gap-4` |
  | popover / card / dialog padding | `p-3` (compact), `p-4` (default) |
  | list row padding | `px-2 py-1.5` |
  | list row holding an icon button | `px-2 py-0.5`, so the button ladder sets the row at 28, 32 and 36 |
  | table cell padding | `px-3 py-2` |

- Density is a prop on collections (`density: "compact" | "default"`), never a global. Compact halves the
  vertical padding only.
- Alignment: every row is `flex items-center` with a fixed-size leading slot (thumbnail, avatar,
  checkbox) so text always starts at the same x. A picker option with a sub-label stays centred and
  takes `py-1`, so its two lines stand as tall as a one-line option with a picture; a tree row with a
  sub-label is `flex items-start`. A multi picker's checkbox centres on the picture beside it; a single
  picker's tick trails the row instead, so an unticked row leaves no gap before its label.
- Truncation: single-line text gets `truncate min-w-0` and a `title` attribute with the full value.
  Never let a widget grow past its container horizontally.

## 3. Sizes

- Controls come in `sm`, `md` (default), `lg`, matching the shadcn button's own steps as this repo
  vendors them: `h-7`, `h-8`, `h-9`, which is 28, 32 and 36. The button reads `sm`, `default` and
  `lg` for those three, `Input` and the select trigger stand at `h-8`, and rule 2's icon-button row
  is the same ladder, so a page mixing a widget and a shadcn button has one set of heights.
  Icons inside controls are `size-4` for sm/md and `size-5` for lg. Thumbnails in list rows are
  `size-6` (sm), `size-8` (md), `size-10` (lg); cards and detail panes use `xl` (h-16) and `2xl` (h-24).
  Avatars follow the first three sizes.
- A chip or a badge sits one step under the control it is in: `xs` (h-5) in sm and `sm` (h-6) in md. An lg
  picker keeps the `sm` chip, since an `md` (h-8) chip would leave 1px under its 36px control. A chip
  reads at medium weight, with a `size-3` or `size-3.5` glyph, and its inline padding is
  optically aligned: the edge beside a glyph takes a step less than a bare text edge (`xs`: `px-1.5`
  bare, `pl-1` beside a glyph), and the edge beside a cross matches the room above the cross, so its
  box sits as far from the right as from the top. The glyph sits `gap-1` from the label at `xs` and `sm` and
  `gap-1.5` above, and the cross a step closer, since its own padding already reads as space. The
  cross grows with the chip, `size-3` at `xs` to `size-4.5` at `lg`.
- A picker control insets its leading edge to match the room above and below the chip or badge it
  holds, so a value sits evenly inside the border. It carries `data-empty`, which
  gives that reading inset back and takes the vertical inset down one step (md: `pl-2 py-0`), so an
  empty control reads as a plain input. A control whose filled value is plain text, `FieldPicker`
  among them, keeps the reading inset in both states. `min-h` never changes, so the height holds
  across the two states; the trailing inset is reserve for the clear and open controls and stays put.
- An icon control — a clear, an open, a remove — is drawn at the glyph's own size and carries a
  44px box on a coarse pointer, as a pseudo-element centred on it, so a finger has something to
  hit and no layout moves. One class string per ladder holds it.
- Width is the caller's business: widgets are `w-full` by default and never set a fixed width. A caller
  wraps in a sized container.

## 4. Motion

Motion explains a change; it never decorates. Every animated property must answer "what did this movement
tell the user".

- Durations: `duration-100` for a popover, a menu, a picker popup or a dialog entering or leaving,
  `duration-150` for hover/press/focus feedback, `duration-200` for chips and rows entering or
  leaving, `duration-300` only for a large expanding panel. Nothing over 300ms.
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
- `--ring` reads at least 3:1 against the surface it sits on, in both themes, for every shipped
  palette; `tools/drives/palette-contrast.js` measures it.
- Disabled: `opacity-50 pointer-events-none`, plus `aria-disabled`; a tile that is mostly a picture
  also greys it (`[&_img]:grayscale`), since a photo at half opacity still reads as a photo. Readonly keeps full contrast and
  removes affordances (no chevron, no clear button).
- Invalid: `aria-invalid` and the shadcn `aria-invalid:` ring/border classes, plus room for a message the
  caller renders.
- Selected rows: `bg-accent text-accent-foreground`. Highlighted (keyboard cursor) uses the same, never a
  second colour.
- A remove control inside a chip or a badge hovers with a wash of its own foreground
  (`hover:bg-current/8`), never the destructive tint: the chip and the status badge read the same.
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

A picker is not built from the primitive. `picker-control`, one item per package, is the control
box with its states, the press rule (a press anywhere on the control toggles the list, the caret
included), the dismissal guard, where the caret lands on open, the keyboard model of core's
`pickerKeyIntent`, the inline token field against the summary trigger with its chip row, and the
popup shell: the search row, the list, the empty, loading and error block, and the load-more row.
A picker supplies its query and rows, its row renderer and its chip, and declares the base as a
registry dependency. A widget that reaches for the Select or the Popover instead says on its docs
page why.

The picker contract. Every picker behaves the same, on the base or on a primitive:

1. A press on the control toggles the list, the caret included, and typing opens it.
2. The caret lands in the control's own input on open, or in the popup's search box on a
   summary control. Every focus call passes `preventScroll`.
3. Escape closes the list and clears the query. On a closed picker it does nothing.
4. Backspace and `ArrowLeft` in an empty query take the caret to the last chip of a multi
   picker, and Backspace clears the value of a single one. On a chip, the arrows walk the
   row, Backspace and Delete remove it and leave the caret on its neighbour, Enter, Space
   and a printable key give the caret back to the input, and `ArrowDown` opens the list.
5. `ArrowUp` and `ArrowDown` keep the highlighted row in view, across a load-more page.
6. A pick keeps a multi picker open and closes a single one.
7. An outside press closes the list.
8. The clear control follows `clearable` and is off on a mandatory field.
9. Readonly keeps full contrast and drops the affordances.
10. Disabled is inert.

`tools/drives/picker-contract.js` checks every clause that applies to a picker's shape, on
every picker page, in both frameworks. A picker that keeps a primitive meets the contract all
the same; its docs page says in one line why it keeps the primitive, and the drive is the proof
it behaves alike.

A search widget is not built from the command primitive either. `search-control`, one item per
package, is the query lifecycle — the pause before a query is asked for, the ticket that drops an
answer the next query replaced, the page and its load-more row, and the highlight across that page
— and the list it feeds: the error line, the skeletons shaped like the rows they stand in for, the
empty line, and the rows. A search supplies the read behind it and draws its own rows, and declares
the base as a registry dependency.

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
| `subLabelField` / `subLabel(row)` | the muted line under the label | none |
| `secondaryField` / `secondary(row)` | the right-aligned column, rendered by data type through FieldValue | the entity type when several types are shown, else none |
| `showCode` | show programmatic names beside display names where the row is a field or a type | `false` |
| `fields` | extra fields to request so a caller's own sub-label or secondary can read them | `[]` |

A widget may add props of its own, but never a second spelling for one of these. Presets (user,
project) are configurations of these props, not forks.

`subLabelField` and `secondaryField` take one type everywhere: a bare path, or a column already
resolved from the schema so the value renders by its data type. `fields` only ever means fields to
request; a list of values a widget draws is `details`.

The row itself is one component per framework, `picker-row`, and every widget that lists entity rows
composes it rather than drawing a second one. A list that can tick a row opens the row on an
indicator column, whose width is fixed whether or not the row is ticked, so a label sits at one x
down the whole list.

A status offered as an option is not a badge: a list of options is read by its names, and a column of
pills is noise. The row is the status glyph as its leading mark and the name as plain text beside it,
with the matched runs bold and the code or the count right-aligned after it, in the two pickers and in
the filter bar's facet rows alike. The badge is what a status is where it is a value rather than an
option: the selected value in a control, a list row's status column, a card, a table cell. The stock
sprite was drawn for a light page, so the glyph inverts and keeps its hue in dark; a site's own icon
is left as it was sent.

A popup list fades at whichever edge has more content past it and holds a gutter for its scrollbar,
and carries a live region under it saying what it is doing: the read in flight, the count it
answered, the empty line, or what a failed read said. The live region is what a reader hears; the
state line of rule 5 is what a reader sees, and the two never become one element.

## 10. Wordmark

The site's mark is two tiles, a widget on a widget: an accent tile behind and a quiet ink tile
in front, lifted off it by a gap in the colour of the surface under the mark. It reads
`--primary` for the back tile, `currentColor` at 30% over the ground for the front one,
`--mark-ground` (falling back to `--background`) for the gap, and a fraction of `--radius` for
every corner, so it wears whatever palette, theme and radius the page does. Two rules: the
accent appears once, on the back tile; the front tile stays quiet. The type beside it is the
title split at its first space, the head word in `--foreground` at medium weight and the tail
in `--muted-foreground` at regular, in the site's sans. The source of truth is
`apps/site/src/components/WordmarkMark.astro` for the mark and `Wordmark.astro` for the
lockup; `apps/site/public/favicon.svg` is the mark with the default palette's values pinned,
and follows a change to the mark. The mark belongs to the site; no widget package carries it.
