// The registry's own rules, on the widgets that were slipping on them.
//
//   pnpm qa --start --path /widgets/field-picker/ --framework both --drive tools/drives/registry-rule-slips.js
//   pnpm qa --start --path /widgets/picker-control/ --framework both --drive tools/drives/registry-rule-slips.js
//   pnpm qa --start --path /widgets/entity-tree/ --framework both --drive tools/drives/registry-rule-slips.js
//
// Four readings, each on the page that holds its widget. The field picker's search box takes
// focus on open with the page where it was, and its back, reset and descend controls carry the
// coarse-pointer box of `PICKER_ICON_BUTTON`. A picker control with no placeholder still names
// its combobox. A tree node whose thumbnail field reads empty draws no picture. Whichever of
// the four the page holds are read; a page that holds none fails.

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

  /* the picker control ----------------------------------------------------- */
  const control = root.querySelector('[data-demo-case="named"] [data-slot="department-named-picker-input"]');
  if (control) {
    readings += 1;
    if (control.getAttribute('placeholder')) {
      return fail(`${framework}: the named control shows a placeholder, so it proves nothing`);
    }
    const label = (control.getAttribute('aria-label') ?? '').trim();
    if (label === '') return fail(`${framework}: a control with no placeholder leaves its combobox unnamed`);
    notes.push(`${framework}: the control with no placeholder names its combobox "${label}"`);
  }
  const blank = root.querySelectorAll('[aria-label=""]').length;
  if (blank > 0) return fail(`${framework}: ${blank} elements carry an empty aria-label`);

  /* the tree's thumbnails -------------------------------------------------- */
  const tree = root.querySelector('[data-testid="empty-thumb-tree"]');
  if (tree) {
    readings += 1;
    const items = () => [...tree.querySelectorAll('[role="treeitem"]')];
    if (!(await until(() => items().length > 0))) return fail(`${framework}: the tree drew no nodes`);
    const assets = items().find((node) => node.dataset.path.endsWith('/Asset'));
    if (!assets) return fail(`${framework}: the tree has no Assets folder`);
    assets.click();
    if (!(await until(() => tree.querySelectorAll('[data-slot="thumbnail"]').length > 0))) {
      return fail(`${framework}: opening Assets drew no thumbnails`);
    }
    await wait(500);
    const rows = items().filter((node) => node.dataset.path.includes('/id/'));
    const without = rows.filter((node) => !node.querySelector('[data-slot="thumbnail"]'));
    const broken = [...tree.querySelectorAll('img')].filter((img) => !img.getAttribute('src'));
    if (without.length !== 1) {
      return fail(`${framework}: ${without.length} of ${rows.length} asset rows drew no picture, expected 1`);
    }
    if (broken.length > 0) return fail(`${framework}: ${broken.length} pictures have no source`);
    notes.push(`${framework}: ${rows.length} asset rows, the one whose field reads empty draws no picture`);
  }
}

if (readings === 0) return { verdict: 'FAIL this page holds none of the four widgets' };
return { verdict: `PASS ${readings} readings across ${drawn.join(' and ')}`, notes };
