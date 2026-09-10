# Legacy component spec (ideas only)

Caller-facing behaviour distilled from a previous, unrelated implementation of these widgets.
No code was copied and none may be. Use this as the baseline to match or exceed; the
"gaps" and "fix" notes are requirements for the new implementation.



---

# Shared infrastructure that everything sits on

**Backend surface.** Only two HTTP endpoints and one client-side cache service are touched by this whole set.

The first is an entity search endpoint at `/api/fpt/entities/search`, always POST, always with a JSON body carrying: a site identifier, an array of entity type names, a filter expression, an array of field names to return, and a numeric limit. The response is JSON:API-shaped — a top-level data array whose members each carry an id, a type string, an attributes object, and a relationships object. Every consumer flattens this the same way: id and type lifted, then a display name derived, then attributes spread over the object, then relationships spread on top. Dot-notation fields (a linked field like the project image reached from a Page) come back as *literal keys containing dots*, not nested objects — every image/sublabel lookup relies on that.

The second is a schema endpoint at `/api/schema/<EntityType>`, POST, used only by the single status picker and only when per-project visibility is needed. Its body carries the site, either an explicit array of project ids or an "all active projects" flag, and the name of the field being asked about. The response carries a fields map (keyed by field code name, each entry having a human name, a data type, optionally a display-values map of code→label, optionally a valid-values array, optionally valid-types) plus a separate array of hidden status codes representing the intersection/union of per-project hidden values computed server-side.

The third path is a shared schema cache service with two operations: fetch the full schema for one entity type on one site, and fetch the list of entity types for a site (each entry having a code name and a display name). The cache is process-wide and shared across every component instance; it is the only caching layer present. There is no caching of entity search results across instances.

**Shared helper contracts** (referenced, not included in the folder — their behaviour must be reproduced):

- A display-name helper that, given a flattened entity, returns the best human label.
- A tokenized name filter builder: takes a raw query string, splits on whitespace, and produces a ShotGrid filter that requires *every* token to appear in the name field (so "pub an" matches "Published Anna"). A second variant takes a query plus a list of field names and produces the same all-tokens-must-match semantics but OR'd across name/login/email.
- A filter merge helper that combines the generated name filter with caller-supplied extra filter triples into one filter expression.
- A highlight segmenter that, given a label and the current query, returns an ordered list of text runs each flagged as highlighted or not; the UI renders highlighted runs in bold.
- Schema path helpers: one resolves a dotted field path into a friendly arrow-joined display path (asynchronously, pulling each intermediate entity type's schema through the cache), the other resolves a single dotted path to one display name.
- A status-icon store exposing: per-site-and-code icon info (a display type of html / image_map / image, plus an image-map key, plus base64 image data, plus a background colour triplet), a site base URL lookup, an icon URL composer from site URL + image-map key, and a base64-to-data-URL composer.
- A legacy status sprite table keyed by status code returning sprite x/y/width/height, a CSS filter string, an RGB triplet, and an "is HTML style" flag.
- Filter model helpers (detailed in the filter-launcher section).

**Filter syntax accepted from callers.** Everywhere a caller supplies pre-filters, the shape is raw ShotGrid filter syntax: an array of condition triples (field path, operator, value), with dotted linked-field paths permitted. One place (the multi user picker) additionally constructs the object form — a logical operator plus a conditions array — proving the backend accepts both the array-of-triples form and the nested logical-group object form, and that they can be mixed (a group object may appear as an element inside conditions).

---

# 1. Entity single picker

**Purpose.** One entity of one or more types, chosen by server-side search.

**Inputs.** A two-way-bound selected entity. A required array of entity type names to search across (one for a homogeneous picker, several for a polymorphic one). A required site identifier. An optional change callback. A size variant among small/medium/large, defaulting to small. A placeholder defaulting to a generic "Search…". Independent disabled, read-only, and error flags. A full-width flag. A clearable flag, defaulting off. Presentation hooks: the name of a field holding an image URL (turning on thumbnails), a flag rendering that image as a circle rather than a rounded square, and, mutually exclusive with the image, a function that maps an entity to a Lucide icon component. Sub-label control: either the name of a field to show as the sub-label, or a function computing the sub-label string from the entity; if neither is given the entity's type name is used as the sub-label. A list of additional field names to request from the API (this is what makes the image/sublabel fields actually arrive). An array of caller pre-filters in ShotGrid syntax — this is also the only project-scoping mechanism (scope by adding a project condition yourself; there is no dedicated project prop). A minimum search length, defaulting to 2 characters. A CSS class passthrough.

There is no exclusion list, no allow/deny list, no result-cap prop, and no debounce prop at this level.

**Value shape.** The bound value is a full flattened row: at minimum a numeric id, a type string and a name, plus every attribute and relationship returned by the request, indexed by arbitrary string keys. Callers may hand in a bare reference (type plus id, no name, or a placeholder name of the form "Type 123"). On mount, if the value looks unresolved, the component fires a single-row search filtered by id equality on that entity's own type, with the same field list, limit one, and replaces the bound object with the fully-hydrated row. If the given entity already carries a real name, no request is made; it is simply registered. On request failure the bare reference is kept, its name backfilled to "Type id".

That resolution is a one-shot latch: it will not re-resolve if the caller later swaps in a different bare reference. A reimplementation should key the latch on the reference identity instead.

**Outputs.** Only a change callback, fired with the newly selected full entity or with undefined on clear. The bound value is updated in the same breath. There is no open/close event, no search event, no error event — failures are logged and silently produce an empty result list. The caller-facing error flag is purely a visual state the caller controls.

**Rendering customisation.** The caller cannot override anything. The component itself consumes the base combobox's per-option render slot and hard-codes the row: optional 24-pixel thumbnail (or icon, or a "no image" placeholder tile when a thumbnail field is configured but empty), then a two-line label block (name with matched query runs bolded, then the sub-label), then a right-aligned monospace "#id". Empty state and loading state come from the base combobox; the only lever is the no-results text, which is fixed here to an "no entities found" message.

**Data behaviour.** The requested field list is always the union of id, name, code, title, content and type, plus the image field, plus the sub-label field, plus the caller's additional fields — de-duplicated. Search is triggered by the base combobox's search callback; queries shorter than the minimum are discarded and clear the result list and the stored query (which also clears highlighting). Otherwise it builds the tokenized name filter, merges the caller's pre-filters, and requests at most 20 rows. Client-side filtering of the returned options is explicitly disabled (the filter function is nulled out) so the server is the sole authority on matching. Results are normalised as described above with a display-name fallback chain of name, then code, then title, then content, then the literal "Type id".

Every row ever seen is stashed in a per-instance map so that selection can map an option back to a full row. That map is keyed by the id alone, *not* by type plus id — with a multi-type picker, a Shot and an Asset sharing a numeric id collide. Fix that in a reimplementation by keying on type and id together. The same single-key assumption is present in the option values and in the bound-value comparison.

There is no debounce in this layer (it is either in the base combobox or absent), no pagination, no infinite scroll, no result cache across queries, and no request cancellation — a slow earlier request can overwrite a faster later one.

**Keyboard and a11y.** Entirely delegated to the base combobox: typing filters, arrow keys move the highlight, Enter selects, Escape closes, the clear affordance appears only when clearable. The per-option markup adds no ARIA of its own; thumbnails carry empty alt text (decorative).

**Edge cases handled.** Missing thumbnail when a thumbnail field is configured renders a grey placeholder tile with a struck-through-image glyph rather than a broken image. Unknown/unnamed rows fall back through the code/title/content chain and finally to "Type id". Multi-type search is supported by passing several types, and the type shows in the sub-label by default.

**Edge cases *not* handled**, and worth fixing: when the query drops below the minimum length the result list is emptied, and the currently selected entity is not re-injected into the option list — so the selected row can vanish from the dropdown (the multi variant does re-inject it). If the option-to-entity lookup misses on selection, the change handler silently does nothing rather than clearing or erroring. No de-duplication across types. No handling of a deleted entity that the search cannot resolve beyond the "Type id" fallback.

---

# 2. Entity multi picker

Same conceptual surface as the single picker with these deltas.

**Inputs.** The bound value is an array, defaulting to empty. Instead of a full-width flag it takes a numeric pixel width. Everything else — types, site, change callback, size, placeholder, disabled, read-only, error, clearable, image field, rounded-image flag, icon function, sub-label field or function, additional fields, pre-filters, minimum search length, class — is identical.

**Value shape.** An array of fully-flattened rows. Initial resolution differs and is better: unresolved members (missing from the map, or with no name, or with a placeholder "Type id" name) are grouped by entity type and one batched request is issued per type using an id-in-list filter with the limit set to the number of ids, all types in parallel; results are merged into the map and the map object is reassigned to force reactivity. Failure per type falls back to keeping the bare references with backfilled names. Again this is a one-shot latch.

Note a real ordering hazard to avoid: a standing effect writes every currently-bound value into the lookup map on each change, which can overwrite a freshly-resolved hydrated row with the caller's bare reference. Resolve-then-merge, don't blind-overwrite.

**Option list composition.** Search results first (so keyboard picking always lands on fresh matches), then any currently-selected entity not present in the results appended after — so selections never disappear from the list, and a selected item can be unselected even with an empty query. Duplicates between the two sets are collapsed by id.

**Outputs.** A change callback with the full array of hydrated entities. Selection ids that cannot be mapped back to a row are dropped from the emitted array — silently.

**Rendering.** Identical row to the single picker plus a leading square check indicator on the left that fills purple with a check glyph when selected. Selected-state colours are driven by menu-item CSS variables.

**Everything else** — field list construction, 20-row cap, client-side filtering disabled, no pagination/debounce/error event — matches the single picker.

---

# 3. Project multi picker

A pre-configured wrapper over the entity multi picker, nothing more.

It hard-codes the entity type to Project, sets the thumbnail field to the project image and adds that same field to the requested field list. It re-exposes only a subset of the underlying surface: bound value array, site, change callback, size, placeholder (defaulting to a projects-specific prompt), disabled, error, pixel width, clearable, class. It deliberately does not expose read-only, pre-filters, minimum search length, sub-label control, additional fields, or the rounded-image flag — so project thumbnails are square and the sub-label falls through to the entity type name ("Project") for every row. A reimplementation should consider forwarding pre-filters (for archived-project exclusion) and a status sub-label, since the current one gives the user no way to distinguish active from archived projects.

---

# 4. Page picker

A pre-configured single-entity wrapper for the Page entity, whose value proposition is showing *project context* so identically-named pages can be told apart.

It hard-codes the type to Page, requests the linked project's image and name as additional fields, uses the linked project image as the thumbnail field, and supplies a sub-label function that returns the linked project's name or, when the page has no project, the literal "Global Page". This is the clearest demonstration that dotted linked fields arrive as literal dotted keys and can be used directly as image/sub-label sources.

It exposes bound value, site, change callback, size, placeholder (pages-specific default), disabled, read-only, error, full width, clearable, class. It does not expose pre-filters or minimum search length.

---

# 5. User single picker

**Purpose.** One person, with avatar and initials fallback.

**Inputs.** Bound value, site, change callback, size, placeholder (users-specific default), disabled, error, full width, clearable, class — plus three domain switches: whether to include API users alongside human users (default on), whether to include inactive users (default off), and an array of extra ShotGrid filter conditions. There is no read-only flag, no additional-fields prop, no exclusion list, and no minimum-search-length prop.

**Behaviour.** The searched types are human users plus API users, or human users alone. The requested field list is fixed to id, name, image and type. When inactives are excluded, an active-status condition on the standard status list field with the code "act" is appended to the caller's filters. Query matching uses the tokenized *name-only* filter, merged with those filters. The minimum query length is hard-wired to 2. The cap is 20. Client-side filtering disabled.

**Value shape.** A flattened row with id, type, name, an image URL, and every other returned attribute. Relationships are *dropped* here (unlike the generic entity picker). There is no initial-value resolution at all in this component — a bare reference handed in will be reflected as the selected id, but its label will not be fetched, so it renders blank until the user searches. That is a gap to close in a reimplementation.

**Rendering.** Row is: avatar component (given the image URL, the name for initials, extra-small size), then a two-line block of the highlighted name and an optional sub-label. The sub-label is set only for API users, reading "API User"; human users get none.

**Outputs.** Change callback with the full row or undefined. No error event; failures log and clear results.

**Edge cases.** Inactive users are excluded by default and can be opted back in. Missing avatar images fall back to initials via the shared avatar component (not a broken image). API users are visually distinguished. Deleted/unresolvable users are not handled.

---

# 6. User multi picker

The richest of the user pickers, explicitly positioned as the replacement for an older human-user selector.

**Inputs.** Bound array value, site, change callback, size, placeholder, disabled, error, pixel width, clearable, include-API-users, include-inactive, extra filters, class — plus two things the single version lacks: an additional-fields array (login, email, project memberships, etc.) and an array of logins to exclude from results, intended for "hide people already on this team" cases.

**Search semantics.** Search fields are chosen dynamically: always the name, plus login if login was requested as an additional field, plus email if email was requested. It then builds an all-tokens-must-match filter OR'd across those fields, and combines it with the other filters (active status and caller filters) into an explicit logical-AND group object with a conditions array — normalising for the case where the tokenized helper returns either a single condition or a group. Cap 20; minimum length hard-wired to 2; client-side filtering disabled.

So: to search by login or email you must also request login or email as fields. That coupling should be made explicit or removed in a reimplementation.

**Normalisation.** Same as the generic picker but relationships are unwrapped one level — each relationship key is mapped to its inner data payload — so a caller requesting project memberships gets a usable array rather than a JSON:API envelope.

**Exclusions.** The login exclusion is applied client-side *after* the 20-row cap, so heavy exclusion can produce a nearly empty dropdown even though matches exist beyond the cap. A reimplementation should push exclusions into the server filter.

**Options and value.** Same "search results first, then still-selected items" composition as the entity multi picker. Sub-label logic: API users read "API User"; human users show an at-prefixed login when a login is present; otherwise no sub-label. There is no initial-value hydration here either.

**Rendering.** Check indicator, avatar, highlighted name, sub-label.

---

# 7. Status badge

**Purpose.** Render one ShotGrid status the way ShotGrid renders it, from live site icon data, with a graceful degradation ladder.

**Inputs.** A status code and a display label (both required — the badge does no schema lookup of its own). An optional site identifier, which is what switches on dynamic icons. A display mode of icon-only, text-only, or both (default both). A size variant of small, medium, or large affecting only the text scale — icons keep their natural size capped at 16 pixels square. A class passthrough.

**Rendering ladder**, in strict order:

1. If a site was given but the icon store has nothing for that code, render text only. This is the deliberate accommodation for statuses (notably project statuses) that have no icon registered.
2. If dynamic icon info exists and its display type is HTML, render the label as coloured text using the icon's background colour as the text colour (falling back to the legacy sprite table's colour). This is the "Active"/"Disabled" style.
3. If the display type is an image-map entry, compose a URL from the site base URL and the map key, render it as a small image with empty alt text, followed by the label — each gated on the display mode.
4. If the display type is a custom uploaded image, convert the stored base64 to a data URL and render the same way.
5. If the display type is unrecognised or its data is missing, render a small solid colour block — 8 by 13 pixels, matching ShotGrid's full-block-character look — plus the label.
6. With no site at all, fall back to the legacy sprite sheet: either coloured HTML text (when the legacy table marks the code as an HTML status) or a background-positioned sprite from a static image map, with per-code width, height, offsets and a CSS filter, plus the label.

Images use crisp-edges rendering to avoid blurring small pixel icons. The whole badge is a nowrap inline flex row with a small gap.

**Outputs, slots, keyboard.** None — it is a pure presentational leaf, not focusable, not interactive.

**A11y gap to fix.** In icon-only mode nothing conveys the status to a screen reader (alt text is empty and there is no title or label), and in HTML mode the status is distinguished by colour alone. A reimplementation should add an accessible name derived from the label, and a title tooltip in icon-only mode.

---

# 8. Status single select

**Purpose.** Pick one status code for a given entity type, with per-project visibility awareness.

**Inputs.** A two-way-bound status code string. A required entity type and site. An optional override for which field carries the statuses — defaulting to the project status field for the Project type and to the standard status list field for everything else. An optional array of project ids to scope visibility to, and a boolean "all active projects" mode where the server resolves the active project set and computes the visible intersection itself. A change callback, size, placeholder, disabled, read-only, error, full width, class.

Note this is a plain select, not a combobox: no typeahead search.

**Data behaviour.** Two distinct paths. Without project scoping it reads the shared schema cache for the entity type. With explicit project ids or all-projects mode it deliberately *bypasses* the cache and POSTs to the per-entity schema endpoint with the project scope and the field name, then subtracts the returned hidden status codes.

In both paths, options are derived from the field's display-values map (code to human label) when present, else from a plain valid-values array where the code doubles as the label, else empty. A composite reload key of site, entity type, effective status field and either the literal all-projects marker or the sorted joined project ids drives reloading; the load is skipped when the key is unchanged.

**Stale-value handling.** After loading, if the currently bound value is no longer among the available statuses (project scope changed and hid it), the value is cleared and the change callback fires with undefined — guarded so it fires at most once per distinct status set, to avoid loops with a re-rendering parent.

**Rendering.** Both the option rows and the closed-state value are rendered as status badges, passing the site through so icons resolve. If the option is not yet known (still loading, or a code absent from the schema), the closed state renders a badge using the raw code as both code and label, so the control is never blank.

**Disabled semantics.** Disabled is computed as "not read-only, and either explicitly disabled or still loading" — read-only wins and keeps the control visually live rather than greyed.

**Outputs.** Change callback with the code or undefined; bound value updated. No load or error events; failures log and produce an empty option list.

**Keyboard and a11y.** Delegated wholly to the base select.

---

# 9. Status multi select

Same schema-derived option construction as above, but simpler and with a few gaps to close.

**Inputs.** Bound array of status codes, entity type, site, optional status-field override with the same Project-versus-everything-else default, change callback, size, placeholder, disabled, read-only, error, pixel width, class. It does not support project ids, all-projects mode, or hidden-value subtraction — so per-project status visibility is single-select-only today. Extending it is an obvious "exceed" target.

**Options.** Display-values map first, valid-values array second, empty third. Crucially, it also synthesises fallback options for any currently selected code that is absent from the schema (unknown or deleted status codes, or during the loading window), labelling them with the raw code — so selections are never silently dropped from the display.

**Reload trigger.** Only site and entity type changes trigger a reload; changing the status field override alone does not. Fix that by keying reload on all three.

**Rendering.** A check indicator followed by a status badge per row. Disabled computed the same way as the single version.

---

# 10. Entity type single picker

**Purpose.** Pick one entity type code for a site, presented as a searchable combobox (explicitly because sites can have very many types).

**Inputs.** Bound value — a plain entity type code string. Required site. Change callback, size, placeholder, disabled, error, full width, class. Plus an allow list of type codes and a deny list of type codes.

**Behaviour.** Types are loaded once per site from the shared schema cache's entity-type listing, each entry carrying a code name and a human display name. Loading is triggered only on site change. Allow and deny filtering is applied *reactively at the option-derivation stage*, not at load — an explicit design note in the source, so that a caller switching operation modes (their example is switching into a change-history mode with a restricted type set) sees the list change with no refetch. The allow list is applied first, then the deny list; empty or absent lists mean "no restriction".

Options use the code as the value and the display name as the label. The control is disabled while loading. There is no clearable flag, no read-only flag, and no custom option rendering — it hands a plain option list to the base combobox and lets it do the client-side matching.

**Outputs.** Change callback with the code or undefined.

---

# 11. Entity type multi picker

The multi analogue, with a slightly different and slightly weaker surface.

**Inputs.** Bound array of type codes, site, change callback, size, placeholder, disabled, error, an allow list, a clearable flag defaulting to *on*, and a class. There is no deny list, no read-only, no full-width or width control.

**Behaviour difference worth correcting.** The allow list is applied at *load* time here rather than at option-derivation time, and loading only reruns on site change — so changing the allow list without changing the site does not re-filter the list. Move the filtering to the derived options as the single-select version does.

Otherwise identical: cache-backed type listing, code as value, display name as label, disabled while loading, default option rendering, base combobox handles search and keyboard.

---

# 12. Field picker with drill-down

The most substantial component; nearly everything below is unique to it.

**Inputs.** A two-way-bound field path string. A required root entity type and site. A flag enabling deep-link traversal, defaulting *off*. A change callback that always receives a string (empty string on clear, rather than undefined). A navigation-state callback invoked whenever the drill-down path becomes non-empty or empties again, explicitly so a parent form can adjust its layout for the breadcrumb row. Size, placeholder (a fields-specific default), disabled, error, full width, clearable, class.

Restriction inputs, all optional and all composable:
- A data-type restriction accepting either one type name or an array of them; a field is kept only if its data type is in the set.
- A valid-target-types restriction for entity fields: the field must declare valid target types and at least one must intersect the caller's list.
- An exclusion list of field names, compared against the *full dotted path* of the candidate at its current depth — deliberately so that excluding a root-level field does not also exclude an identically-named field reached through an entity hop.
- A path-pattern hide list, where a pattern hides both the exact path and every descendant beneath it (the documented use is keeping filter editors away from unsupported metadata paths).
- A fully custom predicate receiving the field's code name and its metadata.
- A list of synthetic/computed field descriptors to expose at the top of the list. These are intended for columns produced by data-source executors that are not real schema fields; they bypass the data-type and valid-types restrictions entirely, are shown only at the root level (never inside a drill-down), are labelled with a "computed" sub-label, and are never navigable.

**Value shape.** A single dotted path string. A root field is just its code name. A drilled path is built by joining, for every hop, the hop's field code name and the chosen target entity type, then appending the final leaf field's code name — producing paths of the form field-name, target-type, field-name, target-type, …, leaf. This is exactly ShotGrid's linked-field path syntax and is what the search endpoint accepts as a dotted field.

**Traversal rules — the full set.**

- A field is navigable only when deep links are enabled, its data type is exactly the single-entity type (multi-entity fields are explicitly excluded from traversal), and it declares at least one valid target type.
- If a navigable field declares exactly one target type, activating it descends immediately into that type.
- If it declares several, the picker enters an intermediate "choose the target type" state: the option list is replaced entirely by one synthetic option per valid target type (internally prefixed to mark it as a navigation action), each labelled with the type name and sub-labelled as a navigate-into-entity action, and the placeholder changes to a select-entity-type prompt. Choosing one then descends.
- On descent, a path segment recording the hop's field code name, its human display name and the chosen target type is pushed; the current entity type becomes the target; the schema for that type is loaded (through the shared cache); the search box is cleared by remounting the combobox under an incrementing key; and the input is refocused after a short delay so the dropdown stays open.
- Back navigation pops one segment (or, if the type-choice state is active, just cancels that state), restores the previous entity type or the root, clears search, reloads and refocuses.
- A reset control clears the whole path back to the root.
- The path also resets automatically when focus leaves the component entirely — checked after a delay, and suppressed while a descent is in flight so that the remount does not trigger a spurious reset.
- **There is no depth limit and no cycle detection.** A user can descend indefinitely (project → user → project → …). A reimplementation should impose a configurable maximum depth (two or three hops is the ShotGrid convention) and should detect revisiting a type.
- Restrictions are re-applied at every level against the full path, so exclusions and hide-patterns work correctly inside hops. The data-type and target-type restrictions, however, are applied at *every* level too — meaning if a caller restricts to, say, date fields, the entity fields needed to reach a nested date are filtered out and the nested date becomes unreachable. Traversal-versus-selection restriction should be separated in a reimplementation (allow navigable fields through the filter, restrict only what can be *selected*).

**Path labelling.** Two different labels are produced. The breadcrumb above the input joins the human display names of the current hops with a right-arrow separator, and while choosing a target type it appends the pending field's display name and an italic "Select Type" marker. The closed-state display value for an already-selected dotted path is resolved asynchronously through the schema-path helper, which walks each intermediate type's schema to produce a friendly arrow-joined label; non-dotted values resolve locally against the synthetic list first, then the loaded field list, falling back to the raw code.

**Field metadata normalisation.** From the schema's fields map, each entry becomes: the map key as the code name, the schema's human name (or the key) as the display name, the schema data type (defaulting to text), valid target types coerced to an array from either an array or a single value (or null), and any valid values. Editability and mandatoriness are hard-coded rather than read from the schema — worth actually reading in a reimplementation. The list is sorted alphabetically by display name.

**Option list composition, in order.** In type-choice mode: only the synthetic navigation options. Otherwise: the synthetic computed fields (root level only) unshifted to the front; then the filtered, sorted real fields; and finally, if the current bound value is not present in the list and we are at the root and not choosing a type, the current value is unshifted in as its own option so a deep-linked selection remains displayable. Each real option's value is the field code, label is the display name, and the sub-label is the code name when it differs from the display name (giving the familiar "Human Name / code_name" pairing).

**Row rendering.** A data-type icon (a Lucide mapping covering text, numeric/float/integer, currency, percent, checkbox, date, date-time, status list, list, entity and multi-entity, image, URL, duration and timecode, and a generic document glyph for addressing, serializable, colour, password and summary, with the document glyph as the catch-all), then a two-line block of display name plus monospace code name plus the lowercase data type, then — for navigable fields — a right-chevron affordance whose tooltip advertises both clicking and pressing the right-arrow key. Navigation options render with a link icon, an "entity type" type line and a plain chevron.

**Keyboard.** Beyond the base combobox's typeahead/arrow/Enter/Escape: Right arrow drills into the currently highlighted field (or, in type-choice mode, selects the highlighted target type); Left arrow goes back one level or cancels type choice. Both are handled on a wrapper element and stop propagation so the base combobox does not also act on them.

**A11y and robustness problems to fix.** The right-arrow handler finds the highlighted row by querying the DOM for a highlight class, reads a data attribute for the field name, and — in type-choice mode — reads the *text content* of the label element to determine which entity type to descend into. The chevron affordance is a span with a mousedown handler rather than a button, and the source carries accessibility-lint suppressions for it. Focus management relies on hard-coded 10, 150 and 200 millisecond timers and on remounting the combobox by key. A reimplementation should keep highlight state in the model rather than the DOM, make the chevron a real button excluded from the option's click target, and replace the timer choreography with explicit state.

---

# 13. Field multi-picker

**Purpose.** An ordered list of field paths, built by repeatedly using the single field picker, with drag reordering.

**Inputs.** A two-way-bound array of field path strings. Entity type and site. A deep-links flag defaulting to *on* here (the opposite of the single picker's default). Change callback, size, placeholder, disabled, error, pixel width, a clearable flag defaulting on (which renders a Clear button beside the input), the same data-type restriction, target-types restriction, exclusion list and custom predicate as the single picker, a reorderable flag defaulting on, and a class.

It does not forward the path-hide patterns, the synthetic computed fields, or the navigation-state callback down to the embedded picker — three gaps a reimplementation should close.

**Value shape.** A plain ordered array of dotted path strings. Order is meaningful (this is a column list) and is preserved.

**Behaviour.** The embedded picker is always rendered with no value of its own, full width, and non-clearable; its exclusion list is the caller's exclusions plus every already-selected path, so duplicates cannot be chosen. On each selection the path is appended (guarded against duplicates), the change callback fires with the new array, the embedded picker is remounted under an incrementing key to clear its search, and the input is refocused after a short delay — so a user can add several fields in a row without touching the mouse. The remount-and-refocus happens even when the selection was a rejected duplicate.

Display names for the chips are resolved per path through the schema-path helper, sequentially, with a load key of entity type plus site plus the joined value list to avoid redundant work, and a re-check of that key before committing results so a stale in-flight resolution cannot overwrite a newer one. Clearing the value resets the load key so names reload correctly if the value is later restored.

**Rendering.** Not specified here on purpose: the new widget must not reproduce the old layout. Requirements only: order is meaningful and visible; reorder by pointer and by keyboard; remove per item; a count; a compact variant without ordering for tight spaces.

**Edge cases.** Long paths are truncated with ellipsis and exposed via hover title. Unresolvable display names fall back to the raw path. Duplicate selection is impossible by construction.

**Gaps.** The drag interaction is mouse/HTML5-drag only — there is no keyboard reordering path, and the chips are focusable but do nothing on keypress. Add keyboard move-up/move-down.

---

# 14. Filter launcher

**Purpose.** A compact button pair that opens a modal hosting the real filter editor, and mediates between the editor's tree model and the API's flat model.

**Inputs.** The current filter value in the API's flat form (typed as a recipe-filter). A required entity type for schema lookup. An optional site. A required change callback receiving the new flat value. A disabled flag. A path-pattern hide list that is forwarded straight through to the editor (and from there, evidently, to the field picker inside it).

**Rendering and states.** When the current value is non-empty it shows a low-emphasis secondary "Edit Filters" button with a pencil icon, plus a separate icon-only trash button that clears the filters immediately without opening anything. When empty it shows a single "Add Filters" button with a plus icon. Both respect the disabled flag.

**Emptiness detection.** The current value counts as non-empty when it is truthy, is an object, and has at least one own key. Because arrays are objects, an empty array reads as empty and a populated array reads as non-empty — which is what makes the flat array form work — but note that a nested-group object with keys would also read non-empty even if all of its conditions are blank. The deeper emptiness test lives in the model helper described below.

**Modal and draft semantics.** Opening first loads the field descriptors for the entity type (through a helper that takes entity type and site) — these are needed for serialisation, not for display — then clears any pending draft and opens an extra-large modal titled for filter editing. The editor is given the current flat value, the entity type, the site and the hide patterns, and reports back a filter *tree* on every change; that tree is held only as a pending draft. Nothing is committed until the user presses Apply. The footer offers three actions: a left-aligned "Clear All Filters" that emits an empty value and closes; a "Cancel" that closes and discards the draft; and a primary "Apply Filters".

Apply does three things in order: if no draft was ever produced (the user opened and changed nothing) it just closes; otherwise it runs the emptiness test on the draft tree and, if all conditions are blank, emits an empty array rather than a tree of empty rows; otherwise it serialises the draft tree to the flat form, passing the loaded field descriptors alongside, and emits that.

**The filter model, as inferable from these call sites.**

The editor-facing model is a tree — a filter group — with, at minimum, a logical operator (and/or) and an ordered conditions array whose members are either leaf conditions or nested groups. The direct evidence: the multi user picker builds exactly that shape by hand (a logical operator field and a conditions array containing both a nested group and plain triples) and posts it to the search endpoint, which proves the backend accepts the nested form and that groups and triples are interchangeable inside a conditions array.

The serialised form is the flat ShotGrid form: an array of condition triples of field path, operator and value. Serialisation is *not* a pure structural transform — it requires the field descriptor list, which means it is data-type-aware: it needs the schema to know how to coerce each condition's value into the right wire shape. From what the pickers elsewhere in this set produce, the coercions implied are: entity and multi-entity fields serialise to type-and-id references (or arrays of them), status-list and list fields serialise to codes (or arrays of codes for in/not-in operators), dates and date-times serialise to their own literal/relative forms, and text/number fields serialise as scalars.

The emptiness test walks the tree and reports whether any condition is meaningfully populated — a condition with a field but no value, or a wholly blank row, must not count. It must recurse into nested groups.

The field loader for the editor is separate from the schema cache used by the pickers and returns a lighter field-info shape (enough to drive both the field choices and the serialisation), keyed on entity type and site.

**Per-data-type operator UX, inferred.** The editor is not in this folder, but the call sites narrow it considerably: it is given the entity type, the site and the hide-pattern list, and the hide-pattern semantics are documented on the field picker as a way to keep filter editors away from unsupported linked-field paths — so the editor's field chooser is the field picker with drill-down, restricted by path patterns rather than by data type. That in turn means a filter row is: a field chosen via the drill-down picker, then an operator list that must be derived from the chosen field's data type, then a value editor that must be chosen by data type as well — and the components to build those value editors are precisely the rest of this set (status multi-select for status-list fields, entity multi picker for entity fields with the field's valid target types passed as the searched types, user multi picker for user fields, entity type picker for type-valued fields, plain inputs for text and numbers). Operators must vary by type in the conventional ShotGrid way — equality/inequality and in/not-in for lists and entities, contains/starts/ends for text, comparison and between for numbers and dates, relative-date operators (in the last / in the next / in calendar period) for dates, is/is-not for checkboxes — and the value editor must switch to a multi-value control for the set-valued operators and disappear entirely for the null-ness operators.

**Outputs.** Only the change callback, fired on clear (from either the trash button, the footer clear, or an all-blank apply) and on apply. There is no open/close event and no validation error surface.

---

# 15. Generic base components relied upon

Six shared primitives are imported and never included here. Their conceptual responsibilities, as pinned down by every call site:

**Combobox** — a single-select, text-filterable popover control. It owns: the trigger/input, the popover and its positioning, the option list, the highlight cursor, all keyboard handling (typeahead, up/down, Enter, Escape, and the clear affordance), the empty state and its customisable no-results text, a loading state, disabled/read-only/error visual states, size variants, and full-width sizing. It accepts a flat option list of value/label/optional-sub-label, a current value, a change callback receiving the value or undefined, an optional async search callback invoked as the user types, and a client-side filter predicate that can be explicitly nulled to disable local filtering and defer entirely to the server. It exposes a per-option render slot receiving the option and a state object carrying selected and highlighted flags; the field picker also relies on the option list being re-read reactively and on the component being safely remountable to clear its query. Debouncing of the search callback, if it exists at all, lives here — none of the wrappers debounce, so a reimplementation must decide deliberately (roughly 250 ms with in-flight cancellation is the right default given the 20-row server searches).

**MultiCombobox** — the multi-select analogue. Same responsibilities, but the value is an array of option values, the change callback receives an array, it exposes a clear-all affordance behind the clearable flag, and it takes an explicit pixel width rather than a full-width flag. It keeps the popover open across selections. Every consumer draws its own check indicator inside the option slot, so the base component does not impose one.

**Select** — a non-searchable single select with the same size/placeholder/disabled/read-only/error/full-width surface, a value plus change callback, an option list, a per-option render slot, and additionally a render slot for the *closed-state value* (used by the status picker to draw a badge in the trigger, and to draw a raw-code badge when the option list has not loaded yet).

**MultiSelect** — the non-searchable multi analogue: array value, array change callback, pixel width, read-only support, and a per-option render slot.

**Avatar** — an image-or-initials circle taking an optional image URL, a name used to derive initials when the image is missing or fails, and a size token (extra-small is what these use). It owns the broken-image fallback so callers never see one.

**Modal** — a dialog shell taking a title, a close callback and a size token, with a main content slot and a footer slot. It owns the overlay, focus trapping, Escape-to-close and scroll locking.

**Button** — a button taking a click handler, an emphasis level (none/low/default), a colour (secondary/primary), a size, an icon-only mode, a disabled flag, and a leading-icon slot.

---

# 16. Cross-cutting notes for the reimplementation

**Consistency defects worth normalising.** The two entity pickers, the two user pickers and the two field pickers each diverge in small, unintentional ways: minimum search length is configurable in the entity pickers and hard-wired to 2 in the user pickers; relationships are spread raw in the entity pickers, unwrapped one level in the multi user picker, and dropped in the single user picker; initial-value hydration exists in both entity pickers and in neither user picker; deep links default off in the single field picker and on in the multi one; read-only is threaded through some wrappers and not others; full-width versus pixel-width is split arbitrarily between single and multi variants. Pick one convention for each and apply it everywhere.

**The id-collision bug** in both entity pickers (lookup maps and option values keyed by numeric id alone while the picker may search several types) is the single most important correctness fix.

**Missing capabilities across the board**: no debounce or request cancellation at the wrapper level, no pagination or "load more" past the fixed 20-row cap, no result caching between queries, no error output of any kind (every failure path logs and silently yields empty), no explicit project-scoping prop on the entity pickers (only raw filters), no configurable result cap, and no maximum traversal depth or cycle detection in the field picker.

**Things worth preserving as-is** because they encode real domain knowledge: the name fallback chain through name/code/title/content; the literal dotted-key convention for linked fields; the tokenized all-tokens-must-match search semantics with bolded matched runs; the status field defaulting differently for Project than for everything else; the per-project hidden-status intersection with an all-active-projects server mode; the status badge's five-step icon degradation ladder including the text-only path for icon-less statuses; the field picker's full-path-based exclusion so that exclusions do not leak across hops; the synthetic computed-field escape hatch; the multi picker's "search results first, selected items appended" ordering; and the filter launcher's draft-until-apply semantics with an all-blank tree collapsing to an empty value.
