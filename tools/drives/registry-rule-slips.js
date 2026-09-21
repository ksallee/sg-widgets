// The registry's own rules, on the widgets that were slipping on them.
//
//   pnpm qa --start --path /widgets/field-picker/ --framework both --drive tools/drives/registry-rule-slips.js
//
// The field picker's search box takes focus on open with the page where it was, and its
// back, reset and descend controls carry the coarse-pointer box of `PICKER_ICON_BUTTON`.
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
/** The 44px box a coarse pointer gets, as `PICKER_ICON_BUTTON` spells it. */
const COARSE = 'pointer-coarse:before:size-11';
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

    // The descend control is on a traversable row; pressing it draws the breadcrumb,
    // which is where back and reset are.
    const descend = popup('[data-slot="field-picker-descend"]');
    if (!descend) return fail(`${framework}: the field list offers no traversable row`);
    if (!descend.getAttribute('class').includes(COARSE)) {
      return fail(`${framework}: the descend control misses the coarse-pointer box`);
    }
    descend.click();
    if (!(await until(() => popup('[data-slot="field-picker-back"]')))) {
      return fail(`${framework}: descending drew no breadcrumb`);
    }
    for (const slot of ['field-picker-back', 'field-picker-reset']) {
      const button = popup(`[data-slot="${slot}"]`);
      if (!button) return fail(`${framework}: the breadcrumb has no ${slot}`);
      if (!button.getAttribute('class').includes(COARSE)) {
        return fail(`${framework}: ${slot} misses the coarse-pointer box`);
      }
    }
    notes.push(`${framework}: back, reset and descend all carry the 44px coarse-pointer box`);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(400);
  }
}

if (readings === 0) return { verdict: 'FAIL this page holds none of the widgets read here' };
return { verdict: `PASS ${readings} readings across ${drawn.join(' and ')}`, notes };
