// Collapse all holds across a page of the grouped table: the next page's headers arrive shut.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework both --drive tools/drives/entity-table-collapse-paging.js
//
// Group the table by status, Collapse all, then turn the page: every header the page brings
// is shut, and the state the table emits is still `{ all: true, except: [] }`. Then one
// header opened by hand is the exception, and Expand all opens the rest.

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);
const table = (framework) => pane(framework)?.querySelector('[data-slot="entity-table"]');
const bodyRows = (framework) => [...(table(framework)?.querySelectorAll('tbody tr[data-row-key]') ?? [])];
const headers = (framework) => [...(table(framework)?.querySelectorAll('[data-slot="entity-table-group"]') ?? [])];
const openHeaders = (framework) => headers(framework).filter((h) => h.querySelector('button[aria-expanded="true"]'));
const range = (framework) => pane(framework)?.querySelector('[data-slot="entity-table-range"]')?.textContent.trim() ?? '';
const emitted = (framework) => pane(framework)?.querySelector('[data-collapsed]')?.dataset.collapsed ?? '';
const button = (framework, text) =>
  [...pane(framework).querySelectorAll('button')].find((b) => b.textContent.trim() === text);

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

const ALL_SHUT = JSON.stringify({ all: true, except: [] });

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };
if (!(await until(() => drawn.every((f) => bodyRows(f).length > 0 && range(f).startsWith('1 to 25'))))) {
  return { verdict: 'FAIL the table drew no first page' };
}

for (const framework of drawn) {
  press(button(framework, 'Group by status'));
  if (!(await until(() => headers(framework).length > 1))) {
    return { verdict: `FAIL ${framework} drew fewer than two group headers`, notes };
  }
  const before = headers(framework).length;
  notes.push(`${framework}: ${before} headers on page 1, ${openHeaders(framework).length} open`);

  press(pane(framework).querySelector('[data-demo="collapse-all"]'));
  if (!(await until(() => openHeaders(framework).length === 0 && bodyRows(framework).length === 0))) {
    return { verdict: `FAIL ${framework} left ${openHeaders(framework).length} headers open after Collapse all`, notes };
  }
  if (emitted(framework) !== ALL_SHUT) {
    return { verdict: `FAIL ${framework} emits ${emitted(framework)} after Collapse all`, notes };
  }
  notes.push(`${framework}: Collapse all shut all ${before} and emits ${emitted(framework)}`);

  // The next page is a data change; its headers were never named and arrive shut.
  press(pane(framework).querySelector('[data-slot="entity-table-pager"] button[aria-label="Next page"]'));
  if (!(await until(() => range(framework).startsWith('26 to 50')))) {
    return { verdict: `FAIL ${framework} did not turn the page: "${range(framework)}"`, notes };
  }
  await wait(400);
  const arrived = headers(framework).length;
  const open = openHeaders(framework).length;
  notes.push(`${framework}: page 2 reads "${range(framework)}" with ${arrived} headers, ${open} open, emits ${emitted(framework)}`);
  if (arrived === 0) return { verdict: `FAIL ${framework} drew no header on page 2`, notes };
  if (open > 0 || bodyRows(framework).length > 0) {
    return { verdict: `FAIL ${framework} let ${open} headers arrive open on page 2 under Collapse all`, notes };
  }
  if (emitted(framework) !== ALL_SHUT) {
    return { verdict: `FAIL ${framework} emits ${emitted(framework)} after the page, expected ${ALL_SHUT}`, notes };
  }

  // One header opened by hand is the exception the mode carries.
  press(headers(framework)[0].querySelector('button'));
  if (!(await until(() => openHeaders(framework).length === 1 && bodyRows(framework).length > 0))) {
    return { verdict: `FAIL ${framework} could not open one header against Collapse all`, notes };
  }
  const state = JSON.parse(emitted(framework));
  if (state.all !== true || state.except.length !== 1) {
    return { verdict: `FAIL ${framework} emits ${emitted(framework)} with one header opened by hand`, notes };
  }
  notes.push(`${framework}: one header opened by hand emits ${emitted(framework)}`);

  // Expand all goes the other way, over everything drawn.
  press(pane(framework).querySelector('[data-demo="expand-all"]'));
  if (!(await until(() => openHeaders(framework).length === headers(framework).length))) {
    return { verdict: `FAIL ${framework} left ${openHeaders(framework).length} of ${headers(framework).length} headers shut after Expand all`, notes };
  }
  if (emitted(framework) !== JSON.stringify({ all: false, except: [] })) {
    return { verdict: `FAIL ${framework} emits ${emitted(framework)} after Expand all`, notes };
  }

  // Left as Collapse all, which is what a shot taken with this drive reads.
  press(pane(framework).querySelector('[data-demo="collapse-all"]'));
  await until(() => openHeaders(framework).length === 0);
}

table(drawn[0])?.scrollIntoView({ block: 'center' });
await wait(400);

return { verdict: 'PASS Collapse all holds across a page of the grouped table: its headers arrive shut and the emitted state stays all-shut', notes };
