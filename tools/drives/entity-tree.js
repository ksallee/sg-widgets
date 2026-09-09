// Seed, two levels by keyboard, checkbox propagation, type-ahead and the filter.
const notes = [];
const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const tree = () => pane().querySelectorAll('[data-slot="entity-tree"]')[0];
const items = () => [...tree().querySelectorAll('[role="treeitem"]')];
const at = (path) => items().find((n) => n.dataset.path === path);
const labelOf = (node) => node?.querySelector('[data-slot="entity-tree-label"]')?.textContent.trim();
const cursor = () => items().find((n) => n.getAttribute('tabindex') === '0');
const checkOf = (node) => node?.getAttribute('aria-checked');
const type = (keys) => {
  const from = cursor();
  from.focus();
  for (const key of keys) from.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
};
const press = async (key, times = 1) => {
  for (let i = 0; i < times; i += 1) {
    type([key]);
    await wait(300);
  }
};

for (let i = 0; i < 40 && items().length === 0; i += 1) await wait(250);
if (items().length === 0) return { verdict: 'FAIL the tree rendered no nodes' };

// The seed path opened Project > Shots > Sequence > Shot without a click.
for (let i = 0; i < 40 && !items().some((n) => n.dataset.path.endsWith('/id/862')); i += 1) await wait(250);
const seeded = items().find((n) => n.dataset.path.endsWith('/id/862'));
if (!seeded) return { verdict: 'FAIL seedPath did not open the tree to the shot', notes };
if (seeded.getAttribute('aria-level') !== '4') {
  return { verdict: `FAIL the seeded shot reads aria-level ${seeded.getAttribute('aria-level')}, expected 4`, notes };
}
notes.push(`seedPath opened ${items().length} nodes, down to "${labelOf(seeded)}" at level 4`);

// One tab stop, wherever the cursor sits.
const stops = items().filter((n) => n.getAttribute('tabindex') === '0').length;
if (stops !== 1) return { verdict: `FAIL the tree has ${stops} tab stops, expected 1`, notes };

// Shut the seeded branch, then open two levels with the keyboard alone.
at('/Project/70/Shot/sg_sequence/Sequence/100')?.click();
await wait(300);
at('/Project/70/Shot')?.click();
await wait(300);
const shut = items().length;
if (shut !== 3) return { verdict: `FAIL collapsing the Shots branch left ${shut} nodes, expected 3`, notes };

await press('Home');
await press('ArrowDown', 2);
if (cursor()?.dataset.path !== '/Project/70/Shot') {
  return { verdict: `FAIL ArrowDown landed on ${cursor()?.dataset.path}, expected the Shots folder`, notes };
}
await press('ArrowRight');
for (let i = 0; i < 40 && !items().some((n) => n.dataset.path.includes('/Sequence/')); i += 1) await wait(200);
await press('ArrowRight');
if (!cursor()?.dataset.path.includes('/Sequence/')) {
  return { verdict: `FAIL the second ArrowRight landed on ${cursor()?.dataset.path}`, notes };
}
const branch = cursor().dataset.path;
await press('ArrowRight');
for (let i = 0; i < 40 && !items().some((n) => n.dataset.path.startsWith(`${branch}/id/`)); i += 1) await wait(200);
const leaves = items().filter((n) => n.dataset.path.startsWith(`${branch}/id/`));
if (leaves.length === 0) return { verdict: 'FAIL expanding the sequence by keyboard produced no shots', notes };
notes.push(`two levels by keyboard: ${labelOf(at(branch))} holds ${leaves.length} shots`);

// Space checks the branch the cursor sits on, and every child under it reads checked.
await press(' ');
if (checkOf(at(branch)) !== 'true') {
  return { verdict: `FAIL Space left the branch reading aria-checked ${checkOf(at(branch))}`, notes };
}
const unchecked = leaves.map((n) => n.dataset.path).filter((p) => checkOf(at(p)) !== 'true');
if (unchecked.length > 0) return { verdict: `FAIL ${unchecked.length} children stayed unchecked`, notes };
notes.push(`checking the branch checked all ${leaves.length} children`);

// Unchecking one child leaves the branch mixed.
await press('ArrowDown');
const one = cursor().dataset.path;
await press(' ');
if (checkOf(at(one)) !== 'false') return { verdict: 'FAIL Space did not uncheck the child', notes };
if (checkOf(at(branch)) !== 'mixed') {
  return { verdict: `FAIL the branch reads aria-checked ${checkOf(at(branch))}, expected mixed`, notes };
}
notes.push(`unchecking "${labelOf(at(one))}" left the branch mixed`);
const counted = pane().querySelector('[data-testid="checked-count"]').textContent.trim();
notes.push(`the demo reports ${counted}`);

// Type-ahead walks the labels of the visible list.
await press('Home');
type([...'sh010_0020']);
await wait(300);
if (labelOf(cursor()) !== 'sh010_0020') {
  return { verdict: `FAIL type-ahead landed on "${labelOf(cursor())}", expected sh010_0020`, notes };
}
notes.push('type-ahead reached sh010_0020');

// The filter narrows the nodes already loaded.
const before = items().length;
const input = pane().querySelector('[data-slot="entity-tree-filter"]');
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'sh010_0030');
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
for (let i = 0; i < 20 && items().length === before; i += 1) await wait(200);
if (items().length >= before) return { verdict: `FAIL the filter kept all ${before} nodes`, notes };
notes.push(`the filter narrowed ${before} nodes to ${items().length}`);

// The second tree draws a thumbnail and a sub-label per row.
const shown = pane().querySelectorAll('[data-slot="entity-tree"]')[1];
const assets = [...shown.querySelectorAll('[role="treeitem"]')].find((n) => n.dataset.path.endsWith('/Asset'));
if (!assets) return { verdict: 'FAIL the thumbnail tree has no Assets folder', notes };
assets.click();
for (let i = 0; i < 40 && shown.querySelectorAll('[data-slot="entity-tree-sub-label"]').length === 0; i += 1) {
  await wait(250);
}
const thumbs = shown.querySelectorAll('[data-slot="thumbnail"] img').length;
const subs = shown.querySelectorAll('[data-slot="entity-tree-sub-label"]').length;
if (thumbs === 0 || subs === 0) {
  return { verdict: `FAIL the thumbnail tree drew ${thumbs} thumbnails and ${subs} sub-labels`, notes };
}
notes.push(`with thumbnails on: ${thumbs} images and ${subs} sub-labels`);

return { verdict: 'PASS seed, two keyboard levels, propagation, type-ahead, the filter and thumbnails', notes };
