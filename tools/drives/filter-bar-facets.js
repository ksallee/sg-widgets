// A status facet marks its values with the status glyph before the label, a facet takes
// the caller's name, a pill holds its width with everything ticked, each facet is counted
// under the other facets alone, and an entity facet counts through the site's groups.
//
//   pnpm qa --start --path /widgets/filter-bar/ --framework both --drive tools/drives/filter-bar-facets.js
//
// Two statuses are ticked first: the Kind facet then counts the rows under them, and the
// status facet still lists every status at the counts it had, since no other facet is
// ticked.
//
// The status pill is then opened and every one of its values ticked, which is the worst
// case the bar has: the pill then names two of them, reads `+n` for the rest, carries the
// whole list in its title, and stays inside the cap.
//
// The Note bar counts through `counts`: the From facet lists the mock's people by name
// with the site's own counts and no sample line, and the read-state facet, which the mock
// refuses to group, is tallied from a page of rows and says so under its list.
//
// The read-state facet is the other shape: the API evaluates no `in` on its field, so one
// ticked value emits `is` and two emit an `or` of `is`, and its pill names them comma-joined.

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);
const pill = (framework, field) => pane(framework)?.querySelector(`[data-slot="filter-pill"][data-field="${field}"]`);

/** What a pill's value may take: `max-w-64`, which is 16rem. */
const CAP = 256;

/** A press, the way a mouse makes one. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

async function until(read, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(100);
  }
}

/** The rows of the open checklist, with the count each one carries. */
function listed() {
  const rows = [...document.querySelectorAll('[data-option]')].filter((row) => row.getClientRects().length > 0);
  return rows.length > 0
    ? rows.map((row) => ({
        key: row.dataset.option,
        label: row.querySelector('[title]')?.getAttribute('title') ?? '',
        count: Number(row.querySelector('[data-slot="facet-count"]')?.textContent.trim() ?? NaN),
      }))
    : null;
}

/** The sample line under the open checklist, if it says one. */
const sampleLine = () =>
  [...document.querySelectorAll('[data-slot="facet-sample"]')].find((el) => el.getClientRects().length > 0)?.textContent.trim() ?? null;

/** A total a demo line reads, boxed, since zero is an answer. */
function totalOn(framework, testId, noun) {
  const text = pane(framework)?.querySelector(`[data-testid="${testId}"]`)?.textContent.trim() ?? '';
  const found = new RegExp(`^(\\d+) ${noun}s? match`).exec(text);
  return found ? { n: Number(found[1]) } : null;
}

async function closeList() {
  for (let i = 0; i < 20 && listed(); i += 1) {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(200);
  }
}

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };
if (!(await until(() => drawn.every((f) => pill(f, 'sg_status_list'))))) {
  return { verdict: 'FAIL the bar drew no status pill' };
}

// Counts are scoped per facet: two statuses ticked narrow the Kind facet to the rows
// under them, and the status facet keeps every status at the counts it had.
for (const framework of drawn) {
  const all = await until(() => totalOn(framework, 'result-count', 'Shot'), 15000);
  if (!all) return { verdict: `FAIL ${framework} never counted the unfiltered Shots`, notes };
  press(pill(framework, 'sg_status_list').querySelector('[data-slot="filter-pill-trigger"]'));
  const before = await until(listed);
  if (!before) return { verdict: `FAIL ${framework} listed no value under the status facet`, notes };
  const [first, second] = before;
  if (!second || first.count === 0 || second.count === 0) {
    return { verdict: `FAIL ${framework} has fewer than two statuses with rows to tick`, notes };
  }
  for (const [i, key] of [first.key, second.key].entries()) {
    const row = await until(() => document.querySelector(`[data-option="${CSS.escape(key)}"]`), 15000);
    if (!row) return { verdict: `FAIL ${framework} lost the row for "${key}"`, notes };
    press(row);
    const took = await until(() => {
      const held = pill(framework, 'sg_status_list')?.querySelector('[data-slot="filter-pill-values"]')?.getAttribute('title') ?? '';
      return held.split(', ').filter(Boolean).length === i + 1 ? held : null;
    }, 15000);
    if (!took) return { verdict: `FAIL ${framework} did not take the tick on "${key}"`, notes };
  }
  // The status facet is counted under the other facets alone, and none is ticked.
  const after = await until(() => {
    const rows = listed();
    return rows && rows.length === before.length && rows.every((r) => Number.isFinite(r.count)) ? rows : null;
  }, 15000);
  if (!after || JSON.stringify(after) !== JSON.stringify(before)) {
    return { verdict: `FAIL ${framework} changed the status facet's own counts: ${JSON.stringify(after)} from ${JSON.stringify(before)}`, notes };
  }
  await closeList();

  // The Kind facet counts the rows under the two statuses, which the result line also counts.
  await wait(400);
  const under = await until(() => totalOn(framework, 'result-count', 'Shot'), 15000);
  if (!under) return { verdict: `FAIL ${framework} never counted the Shots under the status filter`, notes };
  press(pill(framework, 'sg_shot_type').querySelector('[data-slot="filter-pill-trigger"]'));
  const kinds = await until(() => {
    const rows = listed();
    return rows && rows.every((r) => Number.isFinite(r.count)) ? rows : null;
  }, 15000);
  if (!kinds) return { verdict: `FAIL ${framework} listed no value under the Kind facet`, notes };
  const sum = kinds.reduce((n, r) => n + r.count, 0);
  notes.push(`${framework}: ${all.n} Shots, ${under.n} under "${first.key}" and "${second.key}", the Kind facet sums to ${sum}`);
  if (sum !== under.n) return { verdict: `FAIL ${framework} counted the Kind facet at ${sum}, the status filter matches ${under.n}`, notes };
  if (sum >= all.n) return { verdict: `FAIL ${framework} did not narrow the Kind facet under the status filter`, notes };
  await closeList();

  // Clear all on this bar alone; the seeded bars under it keep their ticks.
  const bar = pill(framework, 'sg_status_list').closest('[data-slot="filter-bar"]');
  press(bar.querySelector('[data-slot="filter-clear-all"]'));
  if (!(await until(() => !bar.querySelector('[data-slot="filter-pill"][data-active]'), 15000))) {
    return { verdict: `FAIL ${framework} did not clear the ticked facets`, notes };
  }
}

for (const framework of drawn) {
  // The caller's own name reaches the pill, the schema's does not.
  const named = pill(framework, 'sg_shot_type');
  if (!named) return { verdict: `FAIL ${framework} drew no pill for the named facet`, notes };
  const shown = named.textContent.trim();
  if (shown !== 'Kind') {
    return { verdict: `FAIL ${framework} named the facet "${shown}", expected the caller's "Kind"`, notes };
  }
  notes.push(`${framework}: the named facet reads "${shown}"`);

  const status = pill(framework, 'sg_status_list');
  press(status.querySelector('[data-slot="filter-pill-trigger"]'));
  const rows = await until(() => {
    const found = [...document.querySelectorAll('[data-option]')];
    return found.length > 0 ? found : null;
  });
  if (!rows) return { verdict: `FAIL ${framework} listed no value under the status facet`, notes };

  // Every row of a status facet carries the glyph before its label, and none of them a badge.
  const marked = rows.filter((row) => row.querySelector('[data-slot="status-glyph"]'));
  const badged = rows.filter((row) => row.querySelector('[data-slot="status-badge"]'));
  notes.push(`${framework}: ${marked.length} of ${rows.length} status rows carry a glyph mark`);
  if (marked.length !== rows.length) {
    return { verdict: `FAIL ${framework} drew ${rows.length - marked.length} status values with no glyph`, notes };
  }
  if (badged.length > 0) {
    return { verdict: `FAIL ${framework} drew ${badged.length} facet rows as badges`, notes };
  }

  // Tick every one of them, which is the widest a pill can get. A tick rewrites the tree
  // and the counts are read again, so the rows are drawn afresh and each one is found by
  // its key rather than held from before.
  const keys = rows.map((row) => row.dataset.option);
  for (let i = 0; i < keys.length; i += 1) {
    const row = await until(() => document.querySelector(`[data-option="${CSS.escape(keys[i])}"]`), 15000);
    if (!row) return { verdict: `FAIL ${framework} lost the row for "${keys[i]}" before it was ticked`, notes };
    press(row);
    const title = await until(() => {
      const values = pill(framework, 'sg_status_list')?.querySelector('[data-slot="filter-pill-values"]');
      const held = values?.getAttribute('title') ?? '';
      return held.split(', ').filter(Boolean).length === i + 1 ? held : null;
    }, 15000);
    if (!title) return { verdict: `FAIL ${framework} did not take tick ${i + 1} of ${keys.length}`, notes };
  }
  const filled = await until(() => {
    const values = pill(framework, 'sg_status_list')?.querySelector('[data-slot="filter-pill-values"]');
    return values?.querySelector('[data-slot="filter-pill-overflow"]') ? values : null;
  }, 20000);
  if (!filled) return { verdict: `FAIL ${framework} never summarised the ticked values`, notes };

  const width = Math.round(filled.getBoundingClientRect().width);
  const overflow = filled.querySelector('[data-slot="filter-pill-overflow"]').textContent.trim();
  const inPill = filled.querySelectorAll('[data-slot="status-badge"]').length;
  const title = filled.getAttribute('title') ?? '';
  notes.push(
    `${framework}: ${rows.length} ticked, the pill names ${inPill} of them and reads ${overflow}, at ${width}px, title "${title}"`,
  );
  if (width > CAP) return { verdict: `FAIL ${framework} let the pill's value reach ${width}px, over the ${CAP}px cap`, notes };
  if (inPill !== 2) return { verdict: `FAIL ${framework} drew ${inPill} badges in the pill, expected 2`, notes };
  if (overflow !== `+${rows.length - 2}`) {
    return { verdict: `FAIL ${framework} read "${overflow}", expected "+${rows.length - 2}"`, notes };
  }
  if (title.split(', ').length !== rows.length) {
    return { verdict: `FAIL ${framework} put ${title.split(', ').length} values in the title, expected ${rows.length}`, notes };
  }
  // The bar itself stays inside the page it was given.
  const bar = pane(framework).querySelector('[data-slot="filter-bar"]');
  if (bar.scrollWidth > bar.clientWidth + 1) {
    return { verdict: `FAIL ${framework} let the bar overflow: ${bar.scrollWidth} in ${bar.clientWidth}`, notes };
  }
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(200);
}

/** The condition or group the tree holds on one path, wherever it sits. */
function nodeOn(node, path) {
  if (!node) return null;
  if (Array.isArray(node)) return node[0] === path ? node : null;
  const children = node.conditions ?? [];
  if (children.length > 1 && children.every((c) => Array.isArray(c) && c[0] === path)) return node;
  for (const child of children) {
    const found = nodeOn(child, path);
    if (found) return found;
  }
  return null;
}

function emitted(framework, path) {
  const held = pane(framework)?.querySelector('[data-testid="note-filter-json"]')?.textContent ?? 'null';
  try {
    return nodeOn(JSON.parse(held), path);
  } catch {
    return null;
  }
}

// The Note bar counts through `counts`. The From facet lists the mock's people from the
// site's groups, by name with a count and no sample line, and its counts sum to the Note
// total; the read-state facet, which the mock refuses to group, is tallied from a page of
// rows and says so.
const READ = 'read_by_current_user';
for (const framework of drawn) {
  const total = await until(() => totalOn(framework, 'note-count', 'Note'), 15000);
  if (!total) return { verdict: `FAIL ${framework} never counted the Notes`, notes };
  const from = await until(() => pill(framework, 'user'));
  if (!from) return { verdict: `FAIL ${framework} drew no From pill`, notes };
  press(from.querySelector('[data-slot="filter-pill-trigger"]'));
  const people = await until(() => {
    const rows = listed();
    return rows && rows.every((r) => Number.isFinite(r.count)) ? rows : null;
  }, 15000);
  if (!people) return { verdict: `FAIL ${framework} listed nobody under the From facet`, notes };
  const unnamed = people.filter((r) => !r.label || /^HumanUser #/.test(r.label) || !r.key.startsWith('HumanUser:'));
  if (unnamed.length > 0) return { verdict: `FAIL ${framework} listed ${JSON.stringify(unnamed)} without a name under From`, notes };
  const sum = people.reduce((n, r) => n + r.count, 0);
  notes.push(`${framework}: From lists ${people.map((r) => `${r.label} ${r.count}`).join(', ')} over ${total.n} Notes`);
  if (people.some((r) => r.count < 1)) return { verdict: `FAIL ${framework} listed a person with no Note under From`, notes };
  if (sum !== total.n) return { verdict: `FAIL ${framework} counted From at ${sum} over ${total.n} Notes`, notes };
  if (sampleLine()) return { verdict: `FAIL ${framework} read the From facet as a sample: "${sampleLine()}"`, notes };
  await closeList();

  press(pill(framework, READ).querySelector('[data-slot="filter-pill-trigger"]'));
  if (!(await until(() => document.querySelector('[data-option="read"]')))) {
    return { verdict: `FAIL ${framework} listed no value under the read-state facet`, notes };
  }
  const sample = await until(sampleLine);
  notes.push(`${framework}: the read-state facet reads "${sample}"`);
  if (sample !== `Counts from a sample of ${total.n} rows`) {
    return { verdict: `FAIL ${framework} read "${sample}" under the read-state facet, expected a sample of ${total.n} rows`, notes };
  }
  await closeList();
}

// The read-state facet: only `is` and `is_not` are evaluated on the field, so the checklist
// spells its values out rather than sending an `in` that answers the caller's unread rows.
for (const framework of drawn) {
  const readPill = await until(() => pill(framework, READ));
  if (!readPill) return { verdict: `FAIL ${framework} drew no read-state pill`, notes };
  press(readPill.querySelector('[data-slot="filter-pill-trigger"]'));
  if (!(await until(() => document.querySelector('[data-option="read"]')))) {
    return { verdict: `FAIL ${framework} listed no value under the read-state facet`, notes };
  }

  press(document.querySelector('[data-option="read"]'));
  const one = await until(() => emitted(framework, READ), 15000);
  if (!one) return { verdict: `FAIL ${framework} emitted no condition on ${READ}`, notes };
  notes.push(`${framework}: one value emits ${JSON.stringify(one)}`);
  if (JSON.stringify(one) !== JSON.stringify([READ, 'is', 'read'])) {
    return { verdict: `FAIL ${framework} emitted ${JSON.stringify(one)} for one ticked value`, notes };
  }

  press(await until(() => document.querySelector('[data-option="unread"]'), 15000));
  const two = await until(() => {
    const found = emitted(framework, READ);
    return found && !Array.isArray(found) ? found : null;
  }, 15000);
  if (!two) return { verdict: `FAIL ${framework} did not take the second value`, notes };
  notes.push(`${framework}: two values emit ${JSON.stringify(two)}`);
  const wanted = {
    logical_operator: 'or',
    conditions: [
      [READ, 'is', 'read'],
      [READ, 'is', 'unread'],
    ],
  };
  if (JSON.stringify(two) !== JSON.stringify(wanted)) {
    return { verdict: `FAIL ${framework} emitted ${JSON.stringify(two)} for two ticked values`, notes };
  }

  // The pill names both values on one line, separated.
  const values = await until(() => pill(framework, READ)?.querySelector('[data-slot="filter-pill-values"]'), 15000);
  const label = values?.textContent.trim() ?? '';
  notes.push(`${framework}: the read-state pill reads "${label}"`);
  if (label !== 'read, unread') {
    return { verdict: `FAIL ${framework} read "${label}" in the pill, expected "read, unread"`, notes };
  }
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(200);
}

pill(drawn[0], 'sg_status_list')?.scrollIntoView({ block: 'center' });
await wait(400);

return {
  verdict:
    'PASS each facet is counted under the other facets alone, status facets mark their values with the glyph, the pill badges what it holds, a facet takes the caller name, a full pill holds its width, the From facet lists people with the site counts, the read-state facet says it is a sample, and it emits `is` and an `or` of `is` under a comma-joined pill',
  notes,
};
