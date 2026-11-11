# Changelog

Releases of `sg-widgets-core` on npm and of the two registries at https://sg-widgets.vercel.app.
The format is Keep a Changelog.

## 0.4.0 - 2026-11-10

- `sg-widgets-core`: schema writes. `SchemaClient` creates, updates, retires and revives the fields
  of an entity type and reads one field with its wrapped record, as `RestSchemaClient`,
  `ProxySchemaClient` behind `createSchemaProxyHandler`, and `MockSchemaClient` from
  `sg-widgets-core/mock` (#364). `createProxyHandler` takes `{ schema }` to carry those methods; left
  out, they stay a 404.
- `sg-widgets-core`: `predictFieldName` and `hasNonAscii` give the programmatic name a display name
  becomes (#362, #369). `isEligibleProject` says which projects a field's visibility is set for
  (#363). `dataTypeLabel` and `dataTypeOptions` name the data types (#365). `normalizeListValues`,
  `splitListValues` and the other list helpers hold the valid values of a list field (#366).
- Changed: `normalizeField` reads a field's description from the top level of its record, where the
  API puts it, so `FieldSchema.description` is filled from a site (#370). A record that carried the
  description under `properties` no longer yields one.
- Fixed: a row carried by the keyboard in the sortable keeps its grip and its carry across more
  than one arrow press (#371).
- Registries: new `data-type-picker`, `valid-values-editor` and `field-glyphs` (#365, #366).
  `status-multi-picker` offers every status of the site when `entityType` is left out (#366). A
  summary picker gives the caret back to its chevron when the list closes or the value is cleared,
  and the Svelte chevron opens the list on the down arrow (#371). The new items and
  `status-multi-picker` import from core 0.4.0, so a registry copy from this release needs it.

## 0.3.1 - 2026-09-25

- `sg-widgets-core`: `repeatedLabels(labels)` returns the labels more than one entry carries,
  ignoring case and outer spaces (#351). The registry pickers import it, so a registry copy from
  this release needs core 0.3.1.
- Registries: FieldPicker and ColumnPicker tell apart fields that share a display name (#351). The
  single picker closes after a pick and leaves its search empty (#353).

## 0.3.0 - 2026-09-24

- Breaking for a hand-written `SgClient`: the interface gains a required
  `read(entityType, id, options?)`, which reads one row by id (#338). `RestClient`, `ProxyClient`,
  `MockClient` and the query cache have it; a custom client must add it.
- `sg-widgets-core`: `FieldSchema.hideable` keeps `visible.editable` (#339). `MockClient` models
  task templates, dependencies and published files, and answers 404 with the REST body (#340).
  New `selection` module (#342) and `column-choice` module with `EntitySource.addFields` (#344).
- Registries: EntityTable selects many rows by range, toggle, keyboard and "select all matching"
  (#342), and `columnPicker` adds a Columns button whose choice persists per browser and entity
  type (#344).

## 0.2.0 - 2026-09-24

- `sg-widgets-core`: `SgClient` deletes, revives and batches rows. `delete(entityType, id)`,
  `revive(entityType, id)` and `batch(requests)` are on `RestClient`, `ProxyClient` and its
  handler, `MockClient` and the query cache (#331). A custom `SgClient` implementation needs the
  three new methods.

## 0.1.0 - 2026-09-21

First release.

- `sg-widgets-core`: the headless model of Flow Production Tracking fields, filters, statuses,
  schema and search, a REST client and a session adapter, and a mock client at
  `sg-widgets-core/mock`.
- The React registry (Base UI) and the Svelte registry (Bits UI), sixty-odd items each, one
  `sg-widgets` item that installs them all, and the docs site with a page per widget.
