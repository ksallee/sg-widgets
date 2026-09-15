// A status facet badges its values, a facet takes the caller's name, and a pill holds
// its width with everything ticked.
//
//   pnpm qa --start --path /widgets/filter-bar/ --framework both --drive tools/drives/filter-bar-facets.js
//
// The status pill is opened and every one of its values ticked, which is the worst case
// the bar has: the pill then names two of them, reads `+n` for the rest, carries the
// whole list in its title, and stays inside the cap.

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

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };
if (!(await until(() => drawn.every((f) => pill(f, 'sg_status_list'))))) {
  return { verdict: 'FAIL the bar drew no status pill' };
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

  // Every row of a status facet draws a badge rather than its label as text.
  const badged = rows.filter((row) => row.querySelector('[data-slot="status-badge"]'));
  notes.push(`${framework}: ${badged.length} of ${rows.length} status rows carry a badge`);
  if (badged.length !== rows.length) {
    return { verdict: `FAIL ${framework} drew ${rows.length - badged.length} status values as plain text`, notes };
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

pill(drawn[0], 'sg_status_list')?.scrollIntoView({ block: 'center' });
await wait(400);

return { verdict: 'PASS status facets badge their values, a facet takes the caller name, and a full pill holds its width', notes };
