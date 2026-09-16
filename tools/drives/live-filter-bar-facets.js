// Live mode: the values a status facet counts come from the site, not the mock, and each
// row reads as a glyph mark before its name with the count right-aligned. The read-state
// facet then answers two different totals for read and for unread, which is the proof the
// site evaluated a filter that spelled `in` would leave at the caller's unread rows.
//
//   pnpm qa --start --live --path /widgets/filter-bar/ --framework both --drive tools/drives/live-filter-bar-facets.js
const seen = {};
const failures = [];

async function until(read, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(100);
  }
}

const source = $('[data-sg-demo]')?.dataset.source;
if (source !== 'live') return { verdict: `FAIL the toolbar is in ${source} mode, not live` };

// The Connect trigger carries the login state, whether or not the panel is open.
const auth = $('[data-sg-connect]')?.dataset.liveState ?? '';
if (auth !== 'dev' && auth !== 'signed-in') return { verdict: `FAIL live mode is not authenticated: "${auth}"` };

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const pill = await until(() => $('[data-slot="filter-pill"][data-field="sg_status_list"]', pane));
  if (!pill) {
    failures.push(`${framework}: the bar drew no status pill`);
    continue;
  }

  // A press that lands before the island has hydrated does nothing, and the counts are
  // read before the rows are drawn, so the press is repeated until the list answers.
  const trigger = $('[data-slot="filter-pill-trigger"]', pill);
  const rows = () => $$('[data-option]').filter((row) => !row.closest('[data-closed]') && row.getClientRects().length > 0);
  let listed = null;
  for (let i = 0; i < 6 && !listed; i += 1) {
    for (const kind of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      trigger.dispatchEvent(new PointerEvent(kind, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
    }
    trigger.click();
    listed = await until(() => (rows().length > 0 ? rows() : null), 6000);
  }
  if (!listed) {
    failures.push(`${framework}: the status facet counted nothing`);
    continue;
  }

  const drawn = listed.map((row) => ({
    key: row.dataset.option,
    label: row.querySelector('[title]')?.textContent.trim() ?? '',
    count: row.querySelector('[data-slot="facet-count"]')?.textContent.trim() ?? '',
    glyph: Boolean(row.querySelector('[data-slot="status-glyph"]')),
    badge: Boolean(row.querySelector('[data-slot="status-badge"]')),
  }));
  seen[framework] = { values: drawn.length, rows: drawn };
  for (const row of drawn) {
    if (!row.glyph) failures.push(`${framework}: ${row.key} has no status glyph`);
    if (row.badge) failures.push(`${framework}: ${row.key} draws a badge in the checklist`);
    if (!row.label) failures.push(`${framework}: ${row.key} has no text label`);
    if (!row.count) failures.push(`${framework}: ${row.key} has no count`);
  }

  // The next pane's popover cannot open while this one holds the focus scope.
  for (let i = 0; i < 20 && rows().length > 0; i += 1) {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await wait(200);
  }
}

/** What the Note count line reads now, or null while it is on its way. */
function noteTotal(pane) {
  const text = $('[data-testid="note-count"]', pane)?.textContent.trim() ?? '';
  const found = /^(\d+) Notes? match/.exec(text);
  return found ? Number(found[1]) : null;
}

/** The filter the read-state bar emits, as text. */
function noteFilter(pane) {
  return $('[data-testid="note-filter-json"]', pane)?.textContent ?? '';
}

/** One spelling for a filter, whichever whitespace it was printed with. */
function compact(text) {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

/**
 * The total that answers the filter the bar now emits. The count line names the filter
 * it counted, so a total left over from the request before never passes as this one,
 * whether or not the two happen to differ. Boxed, since zero is an answer.
 */
function settled(pane) {
  const line = $('[data-testid="note-count"]', pane);
  if (!line || compact(line.dataset.for ?? '') !== compact(noteFilter(pane))) return null;
  const now = noteTotal(pane);
  return now !== null ? { total: now } : null;
}

function press(el) {
  for (const kind of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(kind, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

// The read-state facet: `read` and `unread` must answer different totals. `in` on this field
// answers the caller's unread rows whatever the list holds, so an unfixed facet reads the
// unread total twice.
for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const pill = await until(() => $('[data-slot="filter-pill"][data-field="read_by_current_user"]', pane));
  if (!pill) {
    failures.push(`${framework}: the bar drew no read-state pill`);
    continue;
  }
  const all = await until(() => settled(pane));
  const trigger = $('[data-slot="filter-pill-trigger"]', pill);
  // A tick redraws the checklist, so every row is found again rather than held from before.
  const option = (key) => $$(`[data-option="${key}"]`).filter((row) => row.getClientRects().length > 0)[0] ?? null;
  let listed = null;
  for (let i = 0; i < 6 && !listed; i += 1) {
    press(trigger);
    listed = await until(() => option('read'), 6000);
  }
  if (!listed || !all) {
    failures.push(`${framework}: the read-state facet listed no value, or the count line never answered`);
    continue;
  }

  press(listed);
  if (!(await until(() => noteFilter(pane).includes('"read"')))) {
    failures.push(`${framework}: the bar emitted no condition for read`);
    continue;
  }
  const read = await until(() => settled(pane), 30000);

  // Untick `read` and tick `unread`, so the two totals are the two halves of the set.
  press(await until(() => option('read'), 15000));
  await until(() => !noteFilter(pane).includes('read_by_current_user'));
  press(await until(() => option('unread'), 15000));
  if (!(await until(() => noteFilter(pane).includes('"unread"')))) {
    failures.push(`${framework}: the bar emitted no condition for unread`);
    continue;
  }
  const unread = await until(() => settled(pane), 30000);

  seen[framework] = {
    ...(seen[framework] ?? {}),
    notes: { all: all.total, read: read?.total ?? null, unread: unread?.total ?? null },
  };
  if (!read || !unread || read.total === unread.total) {
    failures.push(
      `${framework}: the read-state facet answered ${read?.total ?? 'nothing'} for read and ${unread?.total ?? 'nothing'} for unread`,
    );
  }
  for (let i = 0; i < 20 && $$('[data-option]').filter((r) => r.getClientRects().length > 0).length > 0; i += 1) {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await wait(200);
  }
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS the status facet counts the site and marks each row with its glyph, and the read-state facet answers a different total for read and for unread'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
