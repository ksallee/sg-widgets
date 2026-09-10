// Live mode: a facet pill lists the site's own values with the site's own counts, and
// ticking one narrows the result set to the number the pill promised.
//
//   pnpm qa --start --live --project 70 --path /widgets/filter-bar/ --drive tools/drive/live-filter-bar-counts.js
const source = $('[data-sg-demo]')?.dataset.source;
if (source !== 'live') return { verdict: `FAIL the toolbar is in ${source} mode, not live` };

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  }
}

async function until(find, label) {
  for (let i = 0; i < 240; i++) {
    const found = find();
    if (found) return found;
    await wait(250);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function closePopovers() {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => $$('[data-slot="popover-content"]').length === 0 || null, 'the popover to close');
}

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  await closePopovers();
  const count = () => ($('[data-testid="result-count"]', pane)?.textContent ?? '').trim();
  const total = () => Number((count().match(/^(\d+) Shots? match/) ?? [])[1] ?? NaN);
  await until(() => (Number.isFinite(total()) ? count() : null), 'the first count');
  const before = count();

  const pillOf = () => $('[data-slot="filter-pill"][data-field="sg_status_list"]', pane);
  press(await until(pillOf, 'the status pill'));
  // Every value the site holds for the facet, with the count the bar tallied for it.
  const options = await until(() => {
    const found = $$('[data-slot="popover-content"] [data-option]');
    return found.length > 0 ? found : null;
  }, 'the value list');
  const values = options.map((el) => ({
    key: el.dataset.option,
    count: Number($('[data-slot="facet-count"]', el)?.textContent.trim()),
  }));
  const picked = options.find((el) => Number($('[data-slot="facet-count"]', el)?.textContent.trim()) > 0);
  if (!picked) throw new Error('no value carries a count');
  const shown = Number($('[data-slot="facet-count"]', picked).textContent.trim());
  press(picked);
  await closePopovers();

  await until(() => (Number.isFinite(total()) && count() !== before ? count() : null), 'the narrowed count');
  const pill = await until(() => (pillOf()?.dataset.active === 'true' ? pillOf() : null), 'the segmented pill');
  const segments = ['field', 'operator', 'values'].map((part) =>
    ($(`[data-slot="filter-pill-${part}"]`, pill)?.textContent ?? '').replace(/[^\w ,]/g, '').trim(),
  );

  return { framework, before, after: count(), narrowed: total(), shown, values, segments };
}

const results = [await run('svelte'), await run('react')];
const project = JSON.parse(localStorage.getItem('sg-demo:project') ?? 'null');

/**
 * The pill carries the site's own values and its own counts, and the pill reads back as
 * the three segments of the condition it wrote.
 *
 * Without a `counts` callback the bar tallies one page of rows, so a pill's number is a
 * count of what was read and the narrowed total is at least it, never below.
 */
const SAMPLE = 200;

function ok(r) {
  const tallied = r.values.reduce((n, v) => n + v.count, 0);
  return (
    r.values.length > 0 &&
    r.values.some((v) => v.count > 0) &&
    tallied > 0 &&
    tallied <= SAMPLE &&
    r.narrowed >= r.shown &&
    r.segments[0].length > 0 &&
    r.segments[1] === 'is any of' &&
    r.segments[2].length > 0
  );
}

const verdict = results.every(ok) ? 'PASS' : 'FAIL';
return {
  verdict: `${verdict} project ${project?.id} ${results
    .map((r) => `${r.framework} ${r.values.length} values, ${r.before} -> ${r.after} on a pill counting ${r.shown} of the page it read`)
    .join(', ')}`,
  results,
};
