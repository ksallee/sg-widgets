# Changelog

Releases of `sg-widgets-core` on npm and of the two registries at https://sg-widgets.vercel.app.
The format is Keep a Changelog.

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
