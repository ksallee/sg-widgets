// Clause 8 of the picker contract: a mandatory field offers no clear.
//
//   pnpm qa --start --path /widgets/status-picker/ --framework both --drive tools/drives/picker-mandatory-clear.js
//
// The rule is read against the field rather than against a fixture: a control bound to a
// field the site flags mandatory carries `aria-required`, and that is the one that must
// have no clear. Which fields a site flags is the site's business, so the drive says what
// it found and asserts the rule over it. The mock flags Note's status, which is the shape
// the fault was found on; a site that flags none still exercises the other half.

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);
const cell = (framework, demo) => pane(framework)?.querySelector(`[data-demo="${demo}"]`);
const control = (box) => box?.querySelector('[data-slot="status-picker-control"]') ?? null;
const clearOf = (box) => box?.querySelector('[data-slot="status-picker-clear"]') ?? null;
const filled = (box) => Boolean(box?.querySelector('[data-slot="status-badge"]'));
const required = (box) => control(box)?.getAttribute('aria-required') === 'true';

/** The cells the demo passes `clearable={false}`, where the caller's answer wins either way. */
const REFUSED = new Set(['no-code', 'own-secondary']);
/** Every cell the page names, in the order it draws them. */
const CELLS = ['p70', 'p71', 'both', 'project', 'mandatory', 'unknown', 'no-code', 'own-secondary', 'switching'];

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };

for (let i = 0; i < 60; i += 1) {
  if (drawn.every((f) => filled(cell(f, 'unknown')) && control(cell(f, 'mandatory')))) break;
  await wait(250);
}

for (const framework of drawn) {
  const mandatory = [];
  const cleared = [];
  for (const name of CELLS) {
    const box = cell(framework, name);
    if (!box || !control(box)) continue;
    const clear = clearOf(box);
    if (required(box)) {
      mandatory.push(name);
      if (clear) return { verdict: `FAIL ${framework} offers a clear on the mandatory field in ${name}`, notes };
      // Only the clear goes: the value and the way to open the list stay.
      if (!box.querySelector('[data-slot="status-picker-trigger"], [data-slot="picker-control-trigger"]')) {
        return { verdict: `FAIL ${framework} lost the open control on the mandatory field in ${name}`, notes };
      }
    } else if (clear) {
      cleared.push(name);
    } else if (filled(box) && !REFUSED.has(name)) {
      return { verdict: `FAIL ${framework} dropped the clear on ${name}, a field the site does not flag mandatory`, notes };
    }
    if (REFUSED.has(name) && clear) {
      return { verdict: `FAIL ${framework} drew a clear on ${name}, where the caller passed clearable={false}`, notes };
    }
  }
  if (mandatory.length + cleared.length === 0) {
    return { verdict: `FAIL ${framework} read no status picker at all`, notes };
  }
  notes.push(
    `${framework}: aria-required on ${mandatory.length ? mandatory.join(', ') : 'no cell'}, a clear on ${cleared.length} others`,
  );
}

cell(drawn[0], 'mandatory')?.scrollIntoView({ block: 'center' });
await wait(400);

return {
  verdict: 'PASS a field the site flags mandatory offers no clear, every other filled control does, and the caller still wins',
  notes,
};
