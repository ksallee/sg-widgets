// Two fields sharing a display name on the column-picker page: the dual demo adds
// `smart_cut_in` beside `sg_cut_in`, both "Cut In" on the test site, and each chosen one shows
// its path; the Add a column picker on Version descends to Shot and searches "cut in", where a
// row whose label another row carries shows its code, a row with its own label does not, and
// every row carries its path as a title. Needs the test site's Shot fields, so it runs with --live.
//
//   pnpm qa --start --live --path /widgets/column-picker/ --framework svelte --drive tools/drives/dup-field-labels.js

const failures = [];
const seen = {};

async function until(read, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    const value = read();
    if (value) return value;
    await wait(100);
  }
  return read();
}

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
}

function setValue(el, text) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

// The page holds a copy of each demo per framework; only the shown one is driven.
const shown = (name) => $$(`[data-demo="${name}"]`).find((el) => el.getClientRects().length > 0);
const dual = await until(() => shown('dual'));
const field = await until(() => dual.querySelector('[data-slot="column-picker-field"][data-path="smart_cut_in"]'));
if (!field) failures.push('the dual list has no smart_cut_in row');
else {
  press(field);
  const paths = await until(() => {
    const spans = [...dual.querySelectorAll('[data-slot="column-picker-path"]')];
    return spans.length === 2 ? spans : null;
  });
  seen.chosenPaths = paths ? paths.map((s) => s.textContent.trim()) : [];
  if (!paths) failures.push('the two chosen "Cut In" columns do not show their paths');
  seen.chosenTitles = [...dual.querySelectorAll('[data-slot="column-picker-column"] [title]')]
    .map((el) => el.getAttribute('title'))
    .filter((t) => !t.startsWith('Drag') && !t.startsWith('Remove'));
}

const columns = shown('columns');
columns.scrollIntoView({ block: 'start' });
const unique = columns.querySelectorAll('[data-slot="column-picker-path"]').length;
if (unique !== 0) failures.push(`distinct labels show ${unique} paths`);

press(columns.querySelector('[data-slot="field-picker-trigger"]'));
const pop = await until(() => $('[data-picker="field"]'));
const link = await until(() => pop?.querySelector('[title="entity"] [data-slot="field-picker-descend"]'));
if (!link) failures.push('no entity row to descend through');
else {
  press(link);
  const shot = await until(() => [...pop.querySelectorAll('[data-slot="command-item"], [cmdk-item]')].find((el) => el.textContent.trim().startsWith('Shot')));
  if (shot && !shot.hasAttribute('title')) press(shot);
  const input = pop.querySelector('input');
  setValue(input, 'cut in');
  const rows = await until(() => {
    const found = [...pop.querySelectorAll('[title^="entity.Shot."]')].filter((el) => /cut_in$/.test(el.getAttribute('title')));
    return found.length >= 2 ? found : null;
  });
  seen.pickerRows = rows ? rows.map((r) => ({ title: r.getAttribute('title'), text: r.textContent.replace(/\s+/g, ' ').trim() })) : [];
  if (!rows) failures.push('the picker does not list both Cut In fields under Shot');
  else
    for (const r of seen.pickerRows) {
      const code = r.title.split('.').pop();
      const label = r.text.slice(0, r.text.indexOf(code) === -1 ? r.text.length : r.text.indexOf(code));
      const shared = seen.pickerRows.filter((o) => o.text.startsWith('Cut In')).length > 1 && r.text.startsWith('Cut In');
      if (shared !== r.text.includes(code)) failures.push(`${r.title} ${shared ? 'hides' : 'shows'} its code (${label})`);
    }
}

return { verdict: failures.length ? `FAIL ${failures.join('; ')}` : 'PASS shared labels show code and path', seen };
