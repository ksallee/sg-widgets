// Multi-select on the entity-table page: a press toggles a row, Shift+press takes a range from the
// anchor, Cmd+press toggles one, and a Shift+press after a clearing toggle clears the range; Space,
// Shift+ArrowDown and Cmd+A from the keyboard; the header box reads indeterminate over a partial
// page; the line above the table offers every matching row and takes it.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework both --drive tools/drives/entity-table-selection.js

const failures = [];
const seen = {};

async function until(read, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    const value = read();
    if (value) return value;
    await wait(100);
  }
  return read();
}

/** A press with modifiers, the way a mouse makes one. */
function press(el, mods = {}) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', ...mods }));
  }
}

/** A key on whatever holds focus, down and up. */
async function key(name, mods = {}) {
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...mods }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true, ...mods }));
  await wait(80);
}

async function drive(pane, framework) {
  const fail = (what) => failures.push(`${framework}: ${what}`);
  const rows = () => [...pane.querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')];
  const count = () => Number(pane.querySelector('[data-testid="selection-count"]')?.textContent.trim().split(' ')[0] ?? NaN);
  const picked = () => rows().map((row, at) => (row.dataset.state === 'selected' ? at : -1)).filter((at) => at >= 0);
  const cell = (at) => rows()[at]?.querySelector('td[data-column="code"]');
  const header = () => pane.querySelector('[data-slot="entity-table"] thead [data-slot="checkbox"]');
  const expect = async (want, what) => {
    const got = await until(() => (JSON.stringify(picked()) === JSON.stringify(want) ? picked() : null), 20);
    if (!got) fail(`${what}: rows ${JSON.stringify(picked())} are selected, expected ${JSON.stringify(want)}`);
  };

  if (!(await until(() => rows().length >= 8, 80))) return fail('fewer than 8 rows drew');
  pane.querySelector('[data-slot="entity-table"]').scrollIntoView({ block: 'center' });

  press(cell(0));
  await expect([0], 'a press on row 0');
  press(cell(3), { shiftKey: true });
  await expect([0, 1, 2, 3], 'Shift+press on row 3');
  if (header()?.getAttribute('aria-checked') !== 'mixed') fail(`the header box reads ${header()?.getAttribute('aria-checked')} over a partial page`);
  press(cell(1), { metaKey: true });
  await expect([0, 2, 3], 'Cmd+press on row 1');
  press(cell(5), { shiftKey: true });
  await expect([0], 'Shift+press on row 5 after a clearing toggle on row 1');
  press(cell(0), { ctrlKey: true });
  await expect([], 'Ctrl+press on row 0');

  // The keyboard, from the first row's checkbox.
  rows()[0].querySelector('[data-slot="checkbox"]').focus();
  await key(' ');
  await expect([0], 'Space on row 0');
  await key('ArrowDown', { shiftKey: true });
  await key('ArrowDown', { shiftKey: true });
  await expect([0, 1, 2], 'Shift+ArrowDown twice');
  await key('ArrowUp', { shiftKey: true });
  await expect([0, 1], 'Shift+ArrowUp');
  await key('a', { metaKey: true });
  const all = rows().map((_, at) => at);
  await expect(all, 'Cmd+A');
  if (header()?.getAttribute('aria-checked') !== 'true') fail(`the header box reads ${header()?.getAttribute('aria-checked')} over a full page`);

  // Every loaded row is picked and the set holds more: the line offers the rest.
  const offer = await until(() => pane.querySelector('[data-slot="entity-table-select-all"]'));
  if (!offer) {
    fail('no line offered every matching row');
  } else {
    const button = offer.querySelector('button');
    const label = button.textContent.trim();
    press(button);
    const total = await until(() => (count() > rows().length ? count() : null), 60);
    if (!total) fail(`"${label}" left the count at ${count()}`);
    seen[framework] = { offer: offer.textContent.trim().replace(/\s+/g, ' '), total };
  }

  // The header box drops the loaded rows and keeps the rest.
  const before = count();
  press(header());
  const after = await until(() => (count() === before - rows().length ? count() : null), 20);
  if (after === null) fail(`the header box left ${count()} of ${before}, expected ${before - rows().length}`);
  await expect([], 'the header box, unticked');
  if (!seen[framework]) seen[framework] = {};
  seen[framework].afterHeader = count();
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-sg-demo] [data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  await drive(pane, framework);
}

if (Object.keys(seen).length === 0 && failures.length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS press, Shift+press, Cmd+press, Space, Shift+arrows, Cmd+A, the header box and select all matching'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
