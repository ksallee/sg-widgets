// Expand two levels of a project and land on a leaf, then filter and walk with the keyboard.
const notes = [];
const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const items = () => [...pane().querySelectorAll('[data-slot="entity-tree"] [role="treeitem"]')];
const at = (path) => items().find((n) => n.dataset.path === path);
const labelOf = (node) => node.textContent.trim();
const isOpen = (node) => node?.getAttribute('aria-expanded') === 'true';
const collapse = async (path) => {
  const node = at(path);
  if (isOpen(node)) {
    node.click();
    await wait(300);
  }
};
const expand = async (path) => {
  const node = at(path);
  if (node && !isOpen(node)) {
    node.click();
    await wait(300);
  }
};

for (let i = 0; i < 40 && items().length === 0; i += 1) await wait(250);
if (items().length === 0) return { verdict: 'FAIL the tree rendered no nodes' };

// seedPath opened Project > Shots > Sequence > Shot without a click.
for (let i = 0; i < 40 && !items().some((n) => n.dataset.path.endsWith('/id/862')); i += 1) await wait(250);
const seeded = items().find((n) => n.dataset.path.endsWith('/id/862'));
if (!seeded) return { verdict: 'FAIL seedPath did not open the tree to the shot', notes };
notes.push(`seedPath opened ${items().length} nodes, down to "${labelOf(seeded)}"`);

// Shut the seeded branch, then open it two levels by clicking.
await collapse('/Project/70/Shot/sg_sequence/Sequence/100');
await collapse('/Project/70/Shot');
const shut = items().length;
notes.push(`collapsed to ${shut} nodes`);
if (shut !== 3) return { verdict: `FAIL collapsing the Shots branch left ${shut} nodes, expected 3`, notes };

await expand('/Project/70/Shot');
for (let i = 0; i < 40 && !items().some((n) => n.dataset.path.includes('/Sequence/')); i += 1) await wait(200);
const sequence = items().find((n) => n.dataset.path.includes('/Sequence/'));
if (!sequence) return { verdict: 'FAIL expanding Shots produced no sequences', notes };
notes.push(`level one: ${labelOf(sequence)}`);

sequence.click();
for (let i = 0; i < 40 && !items().some((n) => n.dataset.path.includes('/Sequence/') && n.dataset.path.includes('/id/')); i += 1) {
  await wait(200);
}
const leaf = items().find((n) => n.dataset.path.includes('/Sequence/') && n.dataset.path.includes('/id/'));
if (!leaf) return { verdict: 'FAIL expanding a sequence produced no shots', notes };
if (leaf.hasAttribute('aria-expanded')) return { verdict: 'FAIL the shot is not a leaf', notes };
notes.push(`level two leaf: ${labelOf(leaf)}`);

// A leaf click reports the selection.
leaf.click();
await wait(300);
const picked = pane().querySelector('[data-testid="picked"]').textContent.trim();
notes.push(`selected: ${picked}`);
if (picked === 'nothing selected') return { verdict: 'FAIL clicking a leaf emitted no selection', notes };

// The filter narrows the nodes already loaded.
const before = items().length;
const input = pane().querySelector('[data-slot="entity-tree-filter"]');
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, picked);
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
for (let i = 0; i < 20 && items().length === before; i += 1) await wait(200);
if (items().length >= before) return { verdict: `FAIL the filter kept all ${before} nodes`, notes };
notes.push(`filter "${picked}" narrowed ${before} nodes to ${items().length}`);
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '');
input.dispatchEvent(new Event('input', { bubbles: true }));
await wait(300);

// Keyboard: the cursor moves down the visible list.
const cursor = () => items().find((n) => n.getAttribute('aria-selected') === 'true')?.dataset.path;
const from = cursor();
items()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
await wait(250);
if (cursor() === from) return { verdict: 'FAIL ArrowDown did not move the cursor', notes };
notes.push(`ArrowDown moved the cursor from ${from} to ${cursor()}`);

return { verdict: 'PASS seed, two levels, leaf select, filter and keyboard', notes };
