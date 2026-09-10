// The three paging modes on the table demo: the scroller appends a page and says so
// with a loading row, ArrowDown on the last row appends one and keeps the cursor, and a
// group that spans a page boundary stays one group.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework both \
//     --drive tools/drives/collection-paging.js
const notes = [];
// The mock answers no faster than its own latency, which is over the 150ms of
// `docs/design-rules.md`; a site can answer inside it, and a read that quick draws
// nothing, which is what the rule asks for.
const live = localStorage.getItem('sg-demo:source') === 'live';
const panes = () => $$('[data-demo-name="entity-table"] [data-pane]').filter((p) => p.offsetParent !== null);
const rowsIn = (pane) => [...pane.querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')];
const headersIn = (pane) => [...pane.querySelectorAll('[data-slot="entity-table-group"]')];
const scrollerIn = (pane) => pane.querySelector('[data-slot="entity-table-scroll"]');
const loadedIn = (pane) => pane.querySelector('[data-slot="entity-table-loaded"]')?.textContent.trim() ?? '';
const rangeIn = (pane) => pane.querySelector('[data-slot="entity-table-range"]')?.textContent.trim() ?? '';

async function until(test, tries = 60, gap = 200) {
  for (let i = 0; i < tries && !test(); i += 1) await wait(gap);
  return test();
}

function pressButton(pane, label) {
  const button = [...pane.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
  if (button) button.click();
  return Boolean(button);
}

/**
 * Records whether the skeleton row was ever on the page, whatever it is on now.
 *
 * React reuses the sentinel row for the skeleton, so the row arrives as an attribute
 * change there and as an inserted row in Svelte, and a page read from a warm cache is
 * over in less time than a poll interval. All three are watched.
 */
function watchLoading(pane) {
  const state = { seen: false };
  state.look = () => {
    if (pane.querySelector('[data-slot="entity-table-loading"]')) state.seen = true;
    return state.seen;
  };
  const observer = new MutationObserver(state.look);
  observer.observe(pane, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-slot'] });
  state.look();
  state.stop = () => observer.disconnect();
  return state;
}

/** The group headers as label and stated count. */
function groupsIn(pane) {
  return headersIn(pane).map((header) => {
    const button = header.querySelector('button');
    // The count is the last element of the header; the label is what comes before it.
    const count = Number(button.lastElementChild.textContent.trim());
    const label = [...button.children]
      .slice(0, -1)
      .map((part) => part.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { label, count };
  });
}

for (let i = 0; i < 60 && panes().some((p) => rowsIn(p).length === 0); i += 1) await wait(250);
if (panes().length === 0) return { verdict: 'FAIL the demo rendered no pane' };

for (const pane of panes()) {
  const framework = pane.dataset.pane;
  if (!(await until(() => rowsIn(pane).length > 0))) return { verdict: `FAIL ${framework} rendered no rows`, notes };
  // The total is the site's, so only the range the page number implies is asserted.
  if (!(await until(() => /^1 to 25( of \d+)?$/.test(rangeIn(pane))))) {
    return { verdict: `FAIL ${framework} opened on "${rangeIn(pane)}", expected "1 to 25"`, notes };
  }
  notes.push(`${framework}: pages reads "${rangeIn(pane)}"`);

  /* scroll ---------------------------------------------------------------- */

  if (!pressButton(pane, 'Scroll')) return { verdict: `FAIL ${framework} has no Scroll button`, notes };
  const ready = await until(
    () => pane.querySelector('[data-slot="entity-table-sentinel"]') && rowsIn(pane).length === 25,
  );
  if (!ready) {
    return { verdict: `FAIL ${framework} scroll mode left ${rowsIn(pane).length} rows and no sentinel`, notes };
  }
  if (pane.querySelector('[data-slot="entity-table-pager"]')) {
    return { verdict: `FAIL ${framework} still draws the pager in scroll mode`, notes };
  }
  notes.push(`${framework}: scroll reads "${loadedIn(pane)}" over ${rowsIn(pane).length} rows`);

  const loading = watchLoading(pane);
  const before = rowsIn(pane).length;
  const scroller = scrollerIn(pane);
  const started = Date.now();
  scroller.scrollTop = scroller.scrollHeight;
  const grew = await until(
    () => {
      loading.look();
      return rowsIn(pane).length > before;
    },
    250,
    40,
  );
  loading.stop();
  if (!grew) return { verdict: `FAIL ${framework} scrolling to the end loaded no page`, notes };
  if (rowsIn(pane).length !== before + 25) {
    return { verdict: `FAIL ${framework} scrolling left ${rowsIn(pane).length} rows, expected ${before + 25}`, notes };
  }
  const took = Date.now() - started;
  if (!loading.seen && !(live && took < 200)) {
    return { verdict: `FAIL ${framework} showed no loading row over the ${took}ms the page took`, notes };
  }
  if (pane.querySelector('[data-slot="entity-table-loading"]')) {
    return { verdict: `FAIL ${framework} left the loading row up after the page landed`, notes };
  }
  notes.push(
    `${framework}: the scroller added ${rowsIn(pane).length - before} rows in ${took}ms, "${loadedIn(pane)}", loading row ${loading.seen ? 'seen and gone' : 'not drawn, the read landing inside 150ms'}`,
  );

  /* more, from the keyboard ----------------------------------------------- */

  if (!pressButton(pane, 'Load more')) return { verdict: `FAIL ${framework} has no Load more button`, notes };
  if (!(await until(() => pane.querySelector('[data-slot="entity-table-load-more"]')))) {
    return { verdict: `FAIL ${framework} drew no load-more row`, notes };
  }
  const held = rowsIn(pane).length;
  const last = rowsIn(pane)[held - 1];
  const cell = last.querySelector('td[data-column="description"]');
  if (!cell) return { verdict: `FAIL ${framework} has no description cell on the last row`, notes };
  cell.focus();
  if (document.activeElement !== cell) return { verdict: `FAIL ${framework} could not focus the last row`, notes };
  cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  // Until the page lands the cursor is on the row it started on, and after it lands on
  // the first row of the page. Nowhere else, at any moment in between.
  let strayed = '';
  const arrived = await until(
    () => {
      const active = document.activeElement;
      const row = active?.closest?.('tr[data-row-key]') ?? null;
      if (active !== cell && (!row || row !== rowsIn(pane)[held])) strayed = row?.dataset.rowKey ?? String(active?.tagName);
      return rowsIn(pane).length > held;
    },
    250,
    20,
  );
  if (strayed) {
    return { verdict: `FAIL ${framework} moved the cursor to ${strayed} rather than holding it`, notes };
  }
  if (!arrived) return { verdict: `FAIL ${framework} ArrowDown on the last row loaded no page`, notes };
  await wait(300);
  const landed = document.activeElement.closest('tr[data-row-key]');
  const wanted = rowsIn(pane)[held];
  if (!landed || landed !== wanted) {
    return {
      verdict: `FAIL ${framework} left the cursor on "${landed?.dataset.rowKey ?? 'nothing'}", expected "${wanted?.dataset.rowKey}"`,
      notes,
    };
  }
  if (document.activeElement.dataset.column !== 'description') {
    return { verdict: `FAIL ${framework} left the cursor off the column it started in`, notes };
  }
  notes.push(`${framework}: ArrowDown added ${rowsIn(pane).length - held} rows and landed on ${landed.dataset.rowKey}`);

  /* groups across a page boundary ----------------------------------------- */

  if (!pressButton(pane, 'Group by status')) return { verdict: `FAIL ${framework} has no grouping button`, notes };
  if (!(await until(() => headersIn(pane).length > 0))) {
    return { verdict: `FAIL ${framework} grouping drew no headers`, notes };
  }
  await wait(400);
  const opening = groupsIn(pane);
  const openRows = rowsIn(pane).length;
  notes.push(`${framework}: ${opening.length} groups over ${openRows} rows`);
  const row = pane.querySelector('[data-slot="entity-table-load-more"] button');
  if (!row) return { verdict: `FAIL ${framework} lost the load-more row`, notes };
  row.click();
  if (!(await until(() => rowsIn(pane).length > openRows, 50))) {
    return { verdict: `FAIL ${framework} the load-more row loaded no page`, notes };
  }
  await wait(400);
  const after = groupsIn(pane);
  const labels = after.map((group) => group.label);
  if (new Set(labels).size !== labels.length) {
    return { verdict: `FAIL ${framework} a page opened a second group: ${labels.join(' | ')}`, notes };
  }
  const missing = opening.filter((group) => !labels.includes(group.label));
  if (missing.length > 0) {
    return { verdict: `FAIL ${framework} lost the group "${missing[0].label}" over a page boundary`, notes };
  }
  const counted = after.reduce((sum, group) => sum + group.count, 0);
  if (counted !== rowsIn(pane).length) {
    return { verdict: `FAIL ${framework} groups state ${counted} rows against ${rowsIn(pane).length} drawn`, notes };
  }
  const spanning = after.find((group) => {
    const was = opening.find((entry) => entry.label === group.label);
    return was && group.count > was.count;
  });
  if (!spanning) return { verdict: `FAIL ${framework} no group grew over the page boundary`, notes };
  notes.push(
    `${framework}: ${after.length} groups over ${rowsIn(pane).length} rows, "${spanning.label}" grew across the boundary`,
  );
  pressButton(pane, 'Group by status');
  await wait(300);
}

return {
  verdict: 'PASS the scroller, ArrowDown and a grouped table all append a page, in both frameworks',
  notes,
};
