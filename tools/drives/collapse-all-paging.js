// Collapse all holds across a page: the groups the next page brings arrive shut.
//
//   pnpm qa --start --path /widgets/grouped-list/ --framework both --drive tools/drives/collapse-all-paging.js
//
// Read on the derived-key list, which pages with a load-more row. Collapse all, open one
// group by hand, then ask for the next page: every group that arrives is shut, and the
// one opened by hand is still open.

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);
const list = (framework) =>
  pane(framework)?.querySelector('[data-demo-case="derived"] [data-slot="grouped-list"]');
const groups = (framework) => [...(list(framework)?.querySelectorAll('[data-slot="grouped-list-group"]') ?? [])];
const keysOf = (framework) => groups(framework).map((g) => g.dataset.groupKey);
/** A group is open when it draws rows under its header. */
const open = (framework) =>
  groups(framework)
    .filter((g) => g.querySelector('[data-slot="grouped-list-row"]'))
    .map((g) => g.dataset.groupKey);

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

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };
if (!(await until(() => drawn.every((f) => groups(f).length > 1)))) {
  return { verdict: 'FAIL the derived list drew fewer than two groups' };
}

for (const framework of drawn) {
  const before = keysOf(framework);
  notes.push(`${framework}: ${before.length} groups before the next page`);

  press(pane(framework).querySelector('[data-demo="collapse-all"]'));
  if (!(await until(() => open(framework).length === 0))) {
    return { verdict: `FAIL ${framework} left ${open(framework).length} groups open after Collapse all`, notes };
  }
  notes.push(`${framework}: Collapse all shut all ${before.length}`);

  // One group opened by hand is the exception the mode carries.
  const kept = before[0];
  press(groups(framework)[0].querySelector('button'));
  if (!(await until(() => open(framework).length === 1))) {
    return { verdict: `FAIL ${framework} could not open one group against Collapse all`, notes };
  }

  // The next page. Its groups were never named, and must arrive shut.
  const more = list(framework).querySelector('[data-slot="grouped-list-load-more"] button');
  if (!more) return { verdict: `FAIL ${framework} has no load-more control`, notes };
  press(more);
  const grown = await until(() => (keysOf(framework).length > before.length ? keysOf(framework) : null));
  if (!grown) return { verdict: `FAIL ${framework} loaded no further group`, notes };

  const arrived = grown.filter((key) => !before.includes(key));
  const stillOpen = open(framework);
  notes.push(
    `${framework}: the next page brought ${arrived.length} groups, ${grown.length} in all, open: ${stillOpen.join(', ') || 'none'}`,
  );
  const openedByThePage = arrived.filter((key) => stillOpen.includes(key));
  if (openedByThePage.length > 0) {
    return {
      verdict: `FAIL ${framework} let ${openedByThePage.length} groups arrive open under Collapse all`,
      notes,
    };
  }
  if (!stillOpen.includes(kept)) {
    return { verdict: `FAIL ${framework} shut the group that was opened by hand`, notes };
  }
  if (stillOpen.length !== 1) {
    return { verdict: `FAIL ${framework} has ${stillOpen.length} groups open, expected the one`, notes };
  }

  // Expand all goes the other way, over everything loaded.
  press(pane(framework).querySelector('[data-demo="expand-all"]'));
  if (!(await until(() => open(framework).length === grown.length))) {
    return { verdict: `FAIL ${framework} left ${open(framework).length} of ${grown.length} groups open after Expand all`, notes };
  }
  notes.push(`${framework}: Expand all opened all ${grown.length}`);

  // Left as Collapse all with one group opened by hand, which is what a shot taken with
  // this drive reads.
  press(pane(framework).querySelector('[data-demo="collapse-all"]'));
  await until(() => open(framework).length === 0);
  press(groups(framework)[0].querySelector('button'));
  await until(() => open(framework).length === 1);
}

list(drawn[0])?.scrollIntoView({ block: 'center' });
await wait(400);

return { verdict: 'PASS Collapse all holds across a page: the groups it brings arrive shut, and the one opened by hand stays open', notes };
