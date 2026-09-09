// Walk the tree with Right and Left, then search it and read the path off the row.
const notes = [];
const fail = (m) => { notes.push('FAIL ' + m); return { verdict: 'FAIL ' + m, notes }; };

function type(input, text) {
  const proto = Object.getPrototypeOf(input);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter ? setter.call(input, text) : (input.value = text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}
async function until(fn, ms = 6000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) return fail(`no ${framework} pane`);
  const root = $('[data-slot="hierarchical-search"]', pane);
  const items = () => $$('[data-slot="command-item"]', root);
  const input = $('input[data-slot="command-input"]', root);

  /* 1. The project root opens on its two entity-type folders. */
  const top = await until(() => (items().length ? items() : null));
  if (!top) return fail(`${framework}: the tree did not open`);
  const labels = top.map((i) => i.querySelector('[data-slot="search-breadcrumb"] .font-medium')?.textContent.trim());
  if (labels.join('|') !== 'Assets|Shots') return fail(`${framework}: root children are ${labels.join('|')}`);

  /* 2. Right walks down a level, Left walks back up. */
  press(input, 'ArrowDown');
  await wait(60);
  press(input, 'ArrowDown');
  await wait(60);
  press(input, 'ArrowRight');
  const sequences = await until(() => {
    const rows = items().filter((i) => i.dataset.entityType === 'Sequence');
    return rows.length ? rows : null;
  });
  if (!sequences) return fail(`${framework}: Right did not open the Shots folder`);
  if (!$('[data-slot="search-up"]', root)) return fail(`${framework}: no way back up`);
  press(input, 'ArrowLeft');
  if (!(await until(() => items().length === 2 && !$('[data-slot="search-up"]', root)))) {
    return fail(`${framework}: Left did not go back up`);
  }
  notes.push(`${framework}: browsed the project root, ${sequences.length} sequences one level down`);

  /* 3. Searching answers breadcrumbs, and Enter emits the leaf with its path. */
  type(input, 'sh010_0010 fx');
  const results = await until(() => {
    const rows = items().filter((i) => i.dataset.entityType);
    return rows.length ? rows : null;
  });
  if (!results) return fail(`${framework}: no search results`);
  const crumb = results[0].querySelector('[data-slot="search-breadcrumb"]');
  const trail = crumb.getAttribute('title');
  if (!trail.includes('›')) return fail(`${framework}: result is not a breadcrumb: "${trail}"`);
  if (crumb.querySelectorAll('.font-medium').length !== 1) return fail(`${framework}: the leaf is not emphasised`);
  if (crumb.querySelectorAll('.font-semibold').length === 0) return fail(`${framework}: no highlighted runs`);

  press(input, 'ArrowDown');
  await wait(60);
  press(input, 'Enter');
  const chips = await until(() => {
    const found = $$('[data-demo="picked"] [data-slot="entity-chip"]', pane);
    return found.length ? found : null;
  });
  if (!chips) return fail(`${framework}: Enter emitted nothing`);
  const path = chips.map((c) => c.dataset.entityType).join(' > ');
  if (path !== 'Project > Sequence > Shot > Task') return fail(`${framework}: path is ${path}`);
  notes.push(`${framework}: "${trail}" emitted as ${path}`);
}

return { verdict: 'PASS browsed, searched and emitted a full path in both frameworks', notes };
