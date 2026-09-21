// The registry's own rules, on the widgets that were slipping on them.
//
//   pnpm qa --start --path /widgets/field-picker/ --framework both --drive tools/drives/registry-rule-slips.js
//
// The field picker's search box takes focus on open with the page where it was.
const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
/** The panes this run draws. Both islands stay mounted, so only a visible one is read. */
const drawn = ['react', 'svelte'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);
if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };

const fail = (message) => ({ verdict: `FAIL ${message}`, notes });
const until = async (test, tries = 60) => {
  for (let i = 0; i < tries; i += 1) {
    if (test()) return true;
    await wait(250);
  }
  return Boolean(test());
};
const popup = (selector) => document.querySelector(`[data-picker="field"] ${selector}`);
const name = (el) => (el ? `${el.tagName.toLowerCase()}${el.dataset.slot ? `[${el.dataset.slot}]` : ''}` : 'nothing');
let readings = 0;

for (const framework of drawn) {
  const root = pane(framework);

  /* the field picker ------------------------------------------------------- */
  const picker = root.querySelector('[data-slot="field-picker"]');
  if (picker) {
    readings += 1;
    picker.scrollIntoView({ block: 'center' });
    await wait(400);
    const before = window.scrollY;
    if (before === 0) return fail(`${framework}: the field picker sits at the top, so a scroll would not show`);

    root.querySelector('[data-slot="field-picker-trigger"]').click();
    if (!(await until(() => popup('[data-slot="command-input"]')))) {
      return fail(`${framework}: the field picker's popup drew no search box`);
    }
    await wait(400);
    const input = popup('[data-slot="command-input"]');
    if (document.activeElement !== input) {
      return fail(`${framework}: focus sits on ${name(document.activeElement)}, not the search box`);
    }
    if (Math.abs(window.scrollY - before) > 1) {
      return fail(`${framework}: opening the picker moved the page ${Math.round(window.scrollY - before)}px`);
    }
    notes.push(`${framework}: the search box takes focus on open, page still at ${Math.round(before)}`);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(400);
  }
}

if (readings === 0) return { verdict: 'FAIL this page holds none of the widgets read here' };
return { verdict: `PASS ${readings} readings across ${drawn.join(' and ')}`, notes };
