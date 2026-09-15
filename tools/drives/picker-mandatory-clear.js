// Clause 8 of the picker contract: a mandatory field offers no clear.
//
//   pnpm qa --start --path /widgets/status-picker/ --framework both --drive tools/drives/picker-mandatory-clear.js
//
// The demo's Note picker is bound to a field the site flags mandatory; every other
// picker on the page is bound to one it does not. The mandatory one draws no cross with
// a value in it, the others do, and the caller's own `clearable={false}` still wins.

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);
const cell = (framework, demo) => pane(framework)?.querySelector(`[data-demo="${demo}"]`);
const clearOf = (box) => box?.querySelector('[data-slot="status-picker-clear"]') ?? null;
const filled = (box) => Boolean(box?.querySelector('[data-slot="status-badge"]'));

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };

for (let i = 0; i < 60; i += 1) {
  if (drawn.every((f) => filled(cell(f, 'mandatory')) && filled(cell(f, 'unknown')))) break;
  await wait(250);
}

for (const framework of drawn) {
  const mandatory = cell(framework, 'mandatory');
  if (!mandatory) return { verdict: `FAIL ${framework} has no picker on a mandatory field`, notes };
  if (!filled(mandatory)) return { verdict: `FAIL ${framework} left the mandatory picker empty`, notes };
  if (clearOf(mandatory)) {
    return { verdict: `FAIL ${framework} offers a clear on a mandatory field`, notes };
  }
  // The field is still readable and still editable: only the clear is gone.
  const trigger = mandatory.querySelector('[data-slot="status-picker-trigger"], [data-slot="picker-control-trigger"]');
  notes.push(`${framework}: the mandatory field draws a value, no clear, and ${trigger ? 'keeps' : 'lost'} its open control`);
  if (!trigger) return { verdict: `FAIL ${framework} lost the open control on the mandatory field`, notes };

  // An ordinary field keeps its clear, and a caller saying no still means no.
  const ordinary = cell(framework, 'unknown');
  if (!clearOf(ordinary)) {
    return { verdict: `FAIL ${framework} dropped the clear on a field that is not mandatory`, notes };
  }
  const refused = cell(framework, 'no-code');
  if (clearOf(refused)) {
    return { verdict: `FAIL ${framework} drew a clear where the caller passed clearable={false}`, notes };
  }
  notes.push(`${framework}: the ordinary field keeps its clear, and clearable={false} still wins`);
}

cell(drawn[0], 'mandatory')?.scrollIntoView({ block: 'center' });
await wait(400);

return { verdict: 'PASS a mandatory field offers no clear, an ordinary one does, and the caller still wins', notes };
