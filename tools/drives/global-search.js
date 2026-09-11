// Open the palette with the hotkey, type two words, read the groups, pick with the keyboard.
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

/* The command list is replaced whenever its contents change, so never hold on to it. */
const dialogs = () => $$('[data-slot="dialog-content"]');
const list = () => $('[data-slot="dialog-content"] [data-slot="command-list"]');
const inList = (sel) => (list() ? $$(sel, list()) : []);

/* 1. The hotkey reaches both islands on the page. */
if (dialogs().length !== 0) return fail('a dialog was open before anything was pressed');
document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }));
if (!(await until(() => dialogs().length === 2))) return fail(`Cmd+K opened ${dialogs().length} palettes, wanted 2`);
notes.push('Cmd+K opened both palettes');
for (let i = 0; i < 4 && dialogs().length > 0; i++) {
  press(document.activeElement ?? document.body, 'Escape');
  await wait(150);
}
if (dialogs().length !== 0) return fail('Escape did not close the palettes');

/* 2. Per framework: type two words, read the groups, pick with the keyboard. */
for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) return fail(`no ${framework} pane`);
  const before = $('[data-demo="picked"]', pane).textContent.trim();

  $('[data-slot="global-search-trigger"]', pane).click();
  const input = await until(() => $('[data-slot="dialog-content"] input[data-slot="command-input"]'));
  if (!input) return fail(`${framework}: the palette did not open`);

  const recents = inList('[data-slot="command-item"]');
  if (recents.length !== 3) return fail(`${framework}: ${recents.length} recents on an empty query, wanted 3`);

  type(input, 'sh010 0010');
  /* Nothing is requested before the debounce elapses; the skeletons stand in meanwhile. */
  await wait(120);
  if (!list().querySelector('[data-slot="search-loading"]')) return fail(`${framework}: no skeletons while loading`);
  if (inList('[data-slot="command-item"]').length !== 0) return fail(`${framework}: rows before the debounce`);

  const rows = await until(() => {
    const found = inList('[data-slot="command-item"][data-entity-type]');
    return found.length > 0 ? found : null;
  });
  if (!rows) return fail(`${framework}: no results after the debounce; list reads "${list().innerText}"`);

  const groups = inList('[data-slot="command-group"]');
  const headings = groups.map((g) => g.textContent.split('\n')[0].trim()).filter(Boolean);
  const marks = inList('.font-semibold');
  if (marks.length === 0) return fail(`${framework}: no highlighted runs`);
  const marked = [...new Set(marks.map((m) => m.textContent.toLowerCase()))].sort();
  if (!marked.every((t) => t === 'sh010' || t === '0010')) {
    return fail(`${framework}: highlighted runs are not the words typed: ${marked.join(',')}`);
  }
  const types = [...new Set(rows.map((r) => r.dataset.entityType))];
  if (types.length < 2) return fail(`${framework}: results in ${types.length} type group(s), wanted more than one`);
  if (groups.length !== types.length) return fail(`${framework}: ${groups.length} groups for ${types.length} types`);
  const sub = rows[0].querySelector('.text-muted-foreground');
  if (!sub || !sub.textContent.includes('Blue Moon Rising')) {
    return fail(`${framework}: first row has no project sub-label, got "${sub?.textContent}"`);
  }

  /* A first Escape clears the query, a second closes the palette. */
  press(input, 'Escape');
  await wait(200);
  if (dialogs().length !== 1) return fail(`${framework}: the first Escape closed the palette`);
  if (input.value !== '') return fail(`${framework}: the first Escape left "${input.value}" in the box`);
  if (inList('[data-slot="command-item"][data-entity-type]').length !== 0) {
    return fail(`${framework}: the first Escape left results under the box`);
  }
  notes.push(`${framework}: Escape cleared the query and left the palette open`);

  type(input, 'sh010 0010');
  if (!(await until(() => inList('[data-slot="command-item"][data-entity-type]').length > 0))) {
    return fail(`${framework}: the query did not come back after Escape`);
  }

  press(input, 'ArrowDown');
  await wait(80);
  press(input, 'Enter');
  const after = await until(() => {
    const now = $('[data-demo="picked"]', pane).textContent.trim();
    return now !== before && now.startsWith('Selected') ? now : null;
  });
  if (!after) return fail(`${framework}: Enter emitted nothing`);
  if (dialogs().length !== 0) return fail(`${framework}: the palette stayed open after a pick`);
  notes.push(`${framework}: ${rows.length} rows in ${groups.length} groups (${headings.join(', ')}); bold ${marked.join(' + ')}; ${after}`);
}

return { verdict: 'PASS grouped, highlighted, keyboard-picked in both frameworks', notes };
