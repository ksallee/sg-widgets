// Expand two levels of a project and land on a leaf, then filter and walk with the keyboard.
const notes = [];
const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const items = () => [...pane().querySelectorAll('[data-slot="entity-tree"] [role="treeitem"]')];
const at = (path) => items().find((n) => n.dataset.path === path);
const labelOf = (node) => node.textContent.trim();

for (let i = 0; i < 40 && items().length === 0; i += 1) await wait(250);
if (items().length === 0) return { verdict: 'FAIL the tree rendered no nodes' };

// seedPath opened Project > Shots > Sequence > Shot without a click.
for (let i = 0; i < 40 && !items().some((n) => n.dataset.path.endsWith('/id/862')); i += 1) await wait(250);
const seeded = items().find((n) => n.dataset.path.endsWith('/id/862'));
if (!seeded) return { verdict: 'FAIL seedPath did not open the tree to the shot', notes };
notes.push(`seedPath opened ${items().length} nodes, down to "${labelOf(seeded)}"`);

// Collapse the whole project, then expand two levels by clicking.
const root = at('/Project/70');
root.click();
await wait(300);
if (items().length !== 1) return { verdict: `FAIL collapsing the root left ${items().length} nodes`, notes };
root.click();
for (let i = 0; i < 20 && items().length < 2; i += 1) await wait(200);

const shots = at('/Project/70/Shot');
if (!shots) return { verdict: 'FAIL no Shots branch under the project', notes };
shots.click();
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
at('/Project/70').focus();
at('/Project/70').click();
await wait(200);
const from = cursor();
items()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
await wait(250);
if (cursor() === from) return { verdict: 'FAIL ArrowDown did not move the cursor', notes };
notes.push(`ArrowDown moved the cursor from ${from} to ${cursor()}`);

return { verdict: 'PASS seed, two levels, leaf select, filter and keyboard', notes };
