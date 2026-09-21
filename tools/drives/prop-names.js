// The value callbacks are spelled `onValueChange`, and the chosen row carries one attribute.
//
//   pnpm qa --start --path /qa/composition/      --framework both --drive tools/drives/prop-names.js
//   pnpm qa --start --path /widgets/column-picker/ --framework both --drive tools/drives/prop-names.js
//
// Each half runs on the pages that draw what it reads, and the verdict names the halves that ran.
//
// The callbacks: the dialog's Apply reaches the bar, which reaches the page; the sort picker's
// direction control and the editor's Add condition each reach it in turn. The composition page
// records the ones that arrived in `[data-testid="emitted"]`, so a callback left on the old name
// shows as a name that never comes.
//
// The chosen row: every picker marks it `data-checked`. The column picker's field list and the
// entity multi picker's rows are the two that spelled it otherwise, so both are read where they
// are drawn, and the page is checked for the two former spellings at the same time.

const notes = [];
const ran = [];
const OLD = '[data-chosen], [data-selected-entity]';
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);

/** A press, the way a mouse makes one. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

async function until(read, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(100);
  }
}

const widget = (framework, name) => pane(framework)?.querySelector(`[data-qa-widget="${name}"]`);
const slot = (root, name) => root?.querySelector(`[data-slot="${name}"]`);

/** The names the page has seen a value callback fire for, in this pane. */
const emitted = (framework) =>
  (pane(framework)?.querySelector('[data-testid="emitted"]')?.textContent ?? '').split(' ').filter(Boolean);

/** Everything on show for a selector, the popups portalled out of the pane included. */
const visible = (selector, root = document) =>
  [...root.querySelectorAll(selector)].filter((el) => el.getClientRects().length > 0);

async function dismiss() {
  for (let i = 0; i < 8; i += 1) {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(150);
  }
}

/** The former spellings, anywhere on the page, popups included. */
function former(framework, where) {
  const left = document.querySelectorAll(OLD).length;
  return left === 0 ? null : { verdict: `FAIL ${framework} left ${left} rows on a former spelling in ${where}`, notes };
}

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };

if (drawn.every((framework) => pane(framework).querySelector('[data-testid="emitted"]'))) {
  ran.push('the four value callbacks');
  for (const framework of drawn) {
    const bar = widget(framework, 'filter-bar');
    if (!(await until(() => slot(bar, 'filter-launch')))) {
      return { verdict: `FAIL ${framework} drew no More filters control on the bar`, notes };
    }

    // The dialog applies its tree to the bar and the bar emits it to the page: two renamed
    // callbacks in one press.
    press(slot(bar, 'filter-launch'));
    const apply = await until(() => visible('[data-slot="filter-apply"]')[0]);
    if (!apply) return { verdict: `FAIL ${framework} never opened the filter dialog`, notes };
    press(apply);
    if (!(await until(() => emitted(framework).includes('filter-bar')))) {
      return { verdict: `FAIL ${framework}: Apply in the dialog reached no value callback on the bar`, notes };
    }
    notes.push(`${framework}: the dialog's Apply reached the bar's onValueChange`);
    await dismiss();

    // The sort picker emits its keys and its sort string on a direction press.
    const sorter = widget(framework, 'sort-picker');
    press(slot(sorter, 'sort-trigger'));
    const direction = await until(() => visible('[data-slot="sort-direction"] [aria-label="Descending"]')[0]);
    if (!direction) return { verdict: `FAIL ${framework} never opened the sort picker`, notes };
    press(direction);
    if (!(await until(() => emitted(framework).includes('sort-picker')))) {
      return { verdict: `FAIL ${framework}: a direction press reached no value callback on the sort picker`, notes };
    }
    notes.push(`${framework}: a direction press reached the sort picker's onValueChange`);
    await dismiss();

    // The editor emits the whole tree on every edit, and Add condition is one.
    const editor = widget(framework, 'filter-editor');
    const add = await until(() => slot(editor, 'filter-add-condition'));
    if (!add) return { verdict: `FAIL ${framework} drew no Add condition control on the editor`, notes };
    press(add);
    if (!(await until(() => emitted(framework).includes('filter-editor')))) {
      return { verdict: `FAIL ${framework}: an added condition reached no value callback on the editor`, notes };
    }
    notes.push(`${framework}: an added condition reached the editor's onValueChange`);
    await dismiss();
  }
}

// A column picker drawn as two panes lists its fields inline, with the chosen ones ticked.
if (drawn.every((framework) => pane(framework).querySelector('[data-slot="column-picker-available"]'))) {
  ran.push("the column picker's chosen fields");
  for (const framework of drawn) {
    const panes = pane(framework).querySelectorAll('[data-slot="column-picker-available"]');
    let ticked = 0;
    for (const box of panes) {
      const rows = await until(() => {
        const found = visible('[data-slot="column-picker-field"]', box);
        return found.length > 0 ? found : null;
      });
      if (!rows) return { verdict: `FAIL ${framework} listed no field in a column picker pane`, notes };
      ticked += rows.filter((row) => row.getAttribute('data-checked') === 'true').length;
    }
    notes.push(`${framework}: ${ticked} column rows read data-checked`);
    if (ticked === 0) return { verdict: `FAIL ${framework} marked no chosen column with data-checked`, notes };
    const left = former(framework, 'the column picker');
    if (left) return left;
  }
}

// An entity multi picker holds its chosen rows ticked in the list it opens.
if (drawn.every((framework) => pane(framework).querySelector('[data-slot="entity-picker-control"][data-multiple="true"]'))) {
  ran.push("the entity multi picker's chosen rows");
  for (const framework of drawn) {
    press(pane(framework).querySelector('[data-slot="entity-picker-control"][data-multiple="true"]'));
    const rows = await until(() => {
      const found = visible('[data-slot="entity-picker-option"]');
      return found.length > 0 ? found : null;
    });
    if (!rows) return { verdict: `FAIL ${framework} never listed the entity multi picker's rows`, notes };
    const ticked = rows.filter((row) => row.getAttribute('data-checked') === 'true');
    notes.push(`${framework}: ${ticked.length} of ${rows.length} entity rows read data-checked`);
    if (ticked.length === 0) {
      return { verdict: `FAIL ${framework} marked no chosen entity row with data-checked`, notes };
    }
    const left = former(framework, 'the entity multi picker');
    if (left) return left;
    await dismiss();
  }
}

if (ran.length === 0) return { verdict: 'FAIL the page draws none of the widgets this drive reads', notes };

for (const framework of drawn) {
  const left = former(framework, 'the page at rest');
  if (left) return left;
}

return { verdict: `PASS ${ran.join(', ')}: each emits through onValueChange or marks the chosen row data-checked, with neither former spelling on the page`, notes };
