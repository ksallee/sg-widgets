// Seed, two levels by keyboard, checkbox propagation, type-ahead, the search, `*` and the bucket.
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

// `*` opens every branch at the focus level, three levels deep.
await press('Home');
// Long enough for the type-ahead buffer above to have gone stale.
await wait(900);
type([...'sh030']);
await wait(300);
if (!/\/Sequence\/\d+$/.test(cursor()?.dataset.path ?? '')) {
  return { verdict: `FAIL the cursor sits on ${cursor()?.dataset.path}, expected a sequence`, notes };
}
const level = () => items().filter((n) => /\/Sequence\/\d+$/.test(n.dataset.path));
const shutBefore = level().filter((n) => n.getAttribute('aria-expanded') === 'false').length;
const nodesBefore = items().length;
type(['*']);
for (let i = 0; i < 60 && level().some((n) => n.getAttribute('aria-expanded') === 'false'); i += 1) await wait(250);
const stillShut = level().filter((n) => n.getAttribute('aria-expanded') === 'false');
if (stillShut.length > 0) {
  return { verdict: `FAIL * left ${stillShut.length} of ${level().length} sequences shut`, notes };
}
for (let i = 0; i < 60 && items().length <= nodesBefore; i += 1) await wait(250);
if (items().length <= nodesBefore) return { verdict: `FAIL * opened no level under ${level().length} sequences`, notes };
notes.push(`* opened ${shutBefore} shut sequences, ${nodesBefore} nodes to ${items().length}`);

// The search asks the server, opens the tree onto the hit and marks it.
const search = pane().querySelector('[data-slot="entity-tree-search"]');
const typeInto = (text) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, text);
  search.dispatchEvent(new Event('input', { bubbles: true }));
  search.dispatchEvent(new Event('change', { bubbles: true }));
};
at('/Project/70/Shot')?.click();
await wait(300);
const shutAgain = items().length;
typeInto('sh030_0020');
for (let i = 0; i < 60 && items().length <= shutAgain; i += 1) await wait(250);
const hit = items().find((n) => labelOf(n) === 'sh030_0020');
if (!hit) return { verdict: `FAIL the search opened ${items().length} nodes and none was the hit`, notes };
if (!hit.querySelector('[data-slot="entity-tree-label"] .font-semibold')) {
  return { verdict: 'FAIL the hit is not marked', notes };
}
const dimmed = items().filter((n) => n.className.includes('text-muted-foreground'));
if (dimmed.length === 0) return { verdict: 'FAIL nothing outside the hit was dimmed', notes };
notes.push(`searching opened ${shutAgain} nodes to ${items().length}, marked the hit and dimmed ${dimmed.length} rows`);

// Clearing puts the tree back as it was.
typeInto('');
for (let i = 0; i < 20 && items().length !== shutAgain; i += 1) await wait(200);
if (items().length !== shutAgain) {
  return { verdict: `FAIL clearing the search left ${items().length} nodes, expected ${shutAgain}`, notes };
}
notes.push('clearing the search restored the expansion it opened onto');

// A project whose shots sit under no sequence answers them all the same.
const loose = pane().querySelector('[data-testid="loose-tree"]');
const looseItems = () => [...loose.querySelectorAll('[role="treeitem"]')];
for (let i = 0; i < 40 && looseItems().length === 0; i += 1) await wait(250);
const shotsFolder = looseItems().find((n) => n.dataset.path.endsWith('/Shot'));
if (!shotsFolder) return { verdict: 'FAIL the second project has no Shots folder', notes };
shotsFolder.click();
for (let i = 0; i < 40 && looseItems().length < 4; i += 1) await wait(250);
const under = looseItems().filter((n) => n.dataset.path.includes('__none__'));
if (under.length === 0) return { verdict: 'FAIL the ungrouped shots did not come back', notes };
notes.push(`a project with no sequences opened ${under.length} shots: ${under.map(labelOf).join(', ')}`);

// The thumbnail tree draws a thumbnail and a sub-label per row.
const shown = pane().querySelector('[data-testid="thumbnail-tree"]');
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

return { verdict: 'PASS seed, keyboard levels, propagation, type-ahead, *, the search, the bucket and thumbnails', notes };
