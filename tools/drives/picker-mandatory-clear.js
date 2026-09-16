// Clause 8 of the picker contract: a mandatory field offers no clear.
//
//   pnpm qa --start --path /widgets/status-picker/ --framework both --drive tools/drives/picker-mandatory-clear.js
//   pnpm qa --start --path /widgets/list-picker/ --framework both --drive tools/drives/picker-mandatory-clear.js
//
// The expectation comes from the schema, not from the control: each demo cell carries
// `data-field-mandatory`, written from the field the site answered or the field the demo
// passes, and the control must agree with it twice over. A mandatory field carries
// `aria-required` and no clear; every other filled control carries a clear unless the
// caller refused one. A control that stops receiving its field loses `aria-required` and
// grows a clear at once, and the cell's own flag is what catches it.

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);
const cells = (framework) => [...(pane(framework)?.querySelectorAll('[data-demo][data-field-mandatory]') ?? [])];
const control = (box) =>
  box?.querySelector(
    '[data-slot="status-picker-control"], [data-slot="status-multi-picker-control"], [data-slot="list-picker-control"], [data-slot="list-multi-picker-control"]',
  ) ?? null;
const clearOf = (box) => box?.querySelector('[data-slot$="-clear"]') ?? null;
const openOf = (box) => box?.querySelector('[data-slot$="-trigger"]') ?? null;
const filled = (box) => Boolean(box?.querySelector('[data-slot="status-badge"], [data-slot$="-text"], [data-slot$="-chip"]'));
const required = (box) => control(box)?.getAttribute('aria-required') === 'true';

/** The cells the demo passes `clearable={false}`, where the caller's answer wins either way. */
const REFUSED = new Set(['no-code', 'own-secondary']);

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };

// The cells write their flag once the schema answers, and a control draws once its options do.
for (let i = 0; i < 60; i += 1) {
  const ready = drawn.every((f) => {
    const found = cells(f);
    return found.length > 0 && found.some((box) => box.dataset.fieldMandatory === 'true') && found.every((box) => control(box));
  });
  if (ready) break;
  await wait(250);
}

for (const framework of drawn) {
  const mandatory = [];
  const cleared = [];
  for (const box of cells(framework)) {
    const name = box.dataset.demo;
    const flagged = box.dataset.fieldMandatory === 'true';
    if (!control(box)) return { verdict: `FAIL ${framework} drew no picker control in ${name}`, notes };
    const clear = clearOf(box);
    if (flagged !== required(box)) {
      return {
        verdict: `FAIL ${framework} ${name}: the schema says mandatory=${flagged} and the control says aria-required=${required(box)}`,
        notes,
      };
    }
    if (flagged) {
      mandatory.push(name);
      if (clear) return { verdict: `FAIL ${framework} offers a clear on the mandatory field in ${name}`, notes };
      // Only the clear goes: the value and the way to open the list stay.
      if (!openOf(box)) return { verdict: `FAIL ${framework} lost the open control on the mandatory field in ${name}`, notes };
      if (!filled(box)) return { verdict: `FAIL ${framework} lost the value on the mandatory field in ${name}`, notes };
    } else if (clear) {
      if (REFUSED.has(name)) {
        return { verdict: `FAIL ${framework} drew a clear on ${name}, where the caller passed clearable={false}`, notes };
      }
      cleared.push(name);
    } else if (filled(box) && !REFUSED.has(name)) {
      return { verdict: `FAIL ${framework} dropped the clear on ${name}, a field the site does not flag mandatory`, notes };
    }
  }
  if (mandatory.length === 0) return { verdict: `FAIL ${framework} read no mandatory field at all`, notes };
  if (cleared.length === 0) return { verdict: `FAIL ${framework} read no clearable field at all`, notes };
  notes.push(`${framework}: mandatory in ${mandatory.join(', ')}, a clear on ${cleared.length} others`);
}

pane(drawn[0])?.querySelector('[data-demo="mandatory"]')?.scrollIntoView({ block: 'center' });
await wait(400);

return {
  verdict: 'PASS a field the schema flags mandatory reaches the control as aria-required and offers no clear, every other filled control does, and the caller still wins',
  notes,
};
