// Live mode: the values a status facet counts come from the site, not the mock, and each
// row reads as a glyph mark before its name with the count right-aligned.
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

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict: failures.length === 0 ? 'PASS the status facet counts the site and marks each row with its glyph' : `FAIL ${failures.join('; ')}`,
  seen,
};
