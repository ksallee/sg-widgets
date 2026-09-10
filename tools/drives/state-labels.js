// One empty, loading and error block across a collection, a picker and a search
// widget: the same classes, the labels core settles, and a caller's own emptyLabel.
//
//   pnpm qa --start --path /widgets/grouped-list/ --framework both --drive tools/drives/state-labels.js
//
// The grouped list is on the page; the entity picker and the global search are opened
// in same-origin iframes, so the three widgets are read in one run.
const notes = [];
const fail = (m) => ({ verdict: 'FAIL ' + m, notes });

/** The line every empty and error state wears, per rule 5 of the design rules. */
const LINE = ['flex', 'items-center', 'justify-center', 'gap-1.5', 'text-center', 'text-sm'];
const LOADING = 'Loading…';

async function until(fn, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

/** Watch for something that is only on the page while a read is in flight. */
async function glimpse(fn, ms = 4000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(20);
  }
}

// Base UI opens on a click, Bits UI on pointerdown, and neither answers the other.
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
  }
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
}

function type(input, text) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter ? setter.call(input, text) : (input.value = text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Load a page of this site into an iframe and answer its document. */
async function frame(path) {
  const el = document.createElement('iframe');
  el.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:900px;opacity:0;z-index:-1';
  el.src = path;
  const ready = new Promise((resolve) => el.addEventListener('load', resolve, { once: true }));
  document.body.appendChild(el);
  await ready;
  return el.contentDocument;
}

/** What a state block reads and wears. */
function block(el) {
  return {
    state: el.getAttribute('data-state') ?? '',
    text: el.textContent.trim(),
    classes: el.className.toString().split(/\s+/).filter(Boolean),
  };
}

/** Every class rule 5 gives the line, plus the tone and the inset asked for. */
function lineBad(where, seen, wants) {
  const bad = [];
  for (const cls of [...LINE, ...wants.classes]) {
    if (!seen.classes.includes(cls)) bad.push(`no ${cls}`);
  }
  if (seen.state !== wants.state) bad.push(`data-state is "${seen.state}"`);
  if (wants.starts !== undefined) {
    // A line with a retry beside it differs between the two frameworks by a space only.
    if (!seen.text.startsWith(wants.starts)) bad.push(`reads "${seen.text}", wanted it to open "${wants.starts}"`);
  } else if (seen.text !== wants.text) {
    bad.push(`reads "${seen.text}", wanted "${wants.text}"`);
  }
  return bad.length === 0 ? null : `${where}: ${bad.join('; ')}`;
}

const seen = {};

for (const framework of ['svelte', 'react']) {
  /* 1. A collection: the caller's own empty label, then a read that fails. -------- */

  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) return fail(`no ${framework} pane`);
  const states = await until(() => pane.querySelector('[data-demo-case="states"]'));
  if (!states) return fail(`${framework}: no states demo on the grouped list page`);
  const lists = () => [...states.querySelectorAll('[data-slot="grouped-list"]')];
  if (!(await until(() => lists().length === 2))) {
    return fail(`${framework}: the states demo drew ${lists().length} lists, wanted 2`);
  }

  const emptyLine = await until(() => lists()[0].querySelector('[data-slot="state-line"][data-state="empty"]'));
  if (!emptyLine) return fail(`${framework}: the empty list drew no state line`);
  const collectionEmpty = block(emptyLine);
  seen[`${framework} collection empty`] = collectionEmpty;
  const emptyBad = lineBad(`${framework} collection empty`, collectionEmpty, {
    state: 'empty',
    text: 'No Task in this window',
    classes: ['text-muted-foreground', 'py-10'],
  });
  if (emptyBad) return fail(emptyBad);

  const arm = states.querySelector('[data-arm-failure]');
  if (!arm) return fail(`${framework}: the states demo has no arm control`);
  press(arm);

  const busy = await glimpse(() => lists()[1].querySelector('[aria-busy="true"]'));
  if (!busy) return fail(`${framework}: the failing list never drew a loading block`);
  const collectionLoading = busy.getAttribute('aria-label') ?? '';
  seen[`${framework} collection loading`] = collectionLoading;
  if (collectionLoading !== LOADING) {
    return fail(`${framework}: the loading block is named "${collectionLoading}", wanted "${LOADING}"`);
  }

  // The page a failure leaves behind keeps its rows, so the line is the one under
  // them: the same block, with a retry beside it and no body inset.
  const errorLine = await until(() => lists()[1].querySelector('[data-slot="grouped-list-page-error"]'));
  if (!errorLine) return fail(`${framework}: the failing list drew no error line`);
  const collectionError = block(errorLine);
  collectionError.retry = Boolean(errorLine.querySelector('button'));
  seen[`${framework} collection error`] = collectionError;
  const errorBad = lineBad(`${framework} collection error`, collectionError, {
    state: 'error',
    starts: 'Flow PT API error 503',
    classes: ['text-destructive', 'p-2'],
  });
  if (errorBad) return fail(errorBad);
  if (!collectionError.retry) return fail(`${framework} collection error: no retry beside the line`);

  /* 2. A picker: a query that matches nothing, then a read that fails. ----------- */

  const pickerDoc = await frame('/widgets/entity-picker/');
  const pickerPane = await until(() => pickerDoc.querySelector(`[data-pane="${framework}"]`));
  if (!pickerPane) return fail(`${framework}: no pane on the entity picker page`);

  async function openPicker(section) {
    const control = await until(() => section.querySelector('[data-slot="entity-picker-control"]'));
    if (!control) return null;
    press(control);
    return until(() => section.querySelector('input[data-slot="entity-picker-input"]'));
  }

  const single = await until(() => pickerPane.querySelector('[data-demo-case="single"]'));
  const singleInput = single ? await openPicker(single) : null;
  if (!singleInput) return fail(`${framework}: the single picker never opened`);
  type(singleInput, 'zzzzqqq');
  const pickerBusy = await glimpse(() => pickerDoc.querySelector('[data-slot="entity-picker-loading"]'));
  if (!pickerBusy) return fail(`${framework}: the picker never drew its skeletons`);
  const pickerLoading = pickerBusy.getAttribute('aria-label') ?? '';
  seen[`${framework} picker loading`] = pickerLoading;
  if (pickerLoading !== LOADING) {
    return fail(`${framework}: the picker's skeletons are named "${pickerLoading}", wanted "${LOADING}"`);
  }
  const pickerEmptyEl = await until(() => pickerDoc.querySelector('[data-slot="entity-picker-empty"]'));
  if (!pickerEmptyEl) return fail(`${framework}: the picker drew no empty line for a query matching nothing`);
  const pickerEmpty = block(pickerEmptyEl);
  seen[`${framework} picker empty`] = pickerEmpty;
  const pickerEmptyBad = lineBad(`${framework} picker empty`, pickerEmpty, {
    state: 'empty',
    text: 'No match',
    classes: ['text-muted-foreground', 'py-6'],
  });
  if (pickerEmptyBad) return fail(pickerEmptyBad);

  const errorCase = pickerPane.querySelector('[data-demo-case="error"]');
  if (!errorCase) return fail(`${framework}: no error demo on the entity picker page`);
  press(errorCase.querySelector('[data-arm-failure]'));
  const errorInput = await openPicker(errorCase);
  if (!errorInput) return fail(`${framework}: the failing picker never opened`);
  type(errorInput, 'sh');
  const pickerErrorEl = await until(() => pickerDoc.querySelector('[data-slot="entity-picker-error"]'));
  if (!pickerErrorEl) return fail(`${framework}: the failing picker drew no error line`);
  const pickerError = block(pickerErrorEl);
  seen[`${framework} picker error`] = pickerError;
  const pickerErrorBad = lineBad(`${framework} picker error`, pickerError, {
    state: 'error',
    text: 'Flow PT API error 503',
    classes: ['text-destructive', 'py-6'],
  });
  if (pickerErrorBad) return fail(pickerErrorBad);

  /* 3. A search widget: a query that matches nothing. ---------------------------- */

  const searchDoc = await frame('/widgets/global-search/');
  const searchPane = await until(() => searchDoc.querySelector(`[data-pane="${framework}"]`));
  if (!searchPane) return fail(`${framework}: no pane on the global search page`);
  const searchInput = await until(() =>
    searchPane.querySelector('[data-demo="anatomy"] input[data-slot="command-input"]'),
  );
  if (!searchInput) return fail(`${framework}: the inline global search never rendered`);
  type(searchInput, 'zzzzqqq');
  const searchBusy = await glimpse(() => searchPane.querySelector('[data-slot="search-loading"]'));
  if (!searchBusy) return fail(`${framework}: the search never drew its skeletons`);
  const searchLoading = searchBusy.getAttribute('aria-label') ?? '';
  seen[`${framework} search loading`] = searchLoading;
  if (searchLoading !== LOADING) {
    return fail(`${framework}: the search's skeletons are named "${searchLoading}", wanted "${LOADING}"`);
  }
  const searchEmptyEl = await until(() => searchPane.querySelector('[data-slot="search-empty"]'));
  if (!searchEmptyEl) return fail(`${framework}: the search drew no empty line`);
  const searchEmpty = block(searchEmptyEl);
  seen[`${framework} search empty`] = searchEmpty;
  const searchEmptyBad = lineBad(`${framework} search empty`, searchEmpty, {
    state: 'empty',
    text: 'No match',
    classes: ['text-muted-foreground', 'py-6'],
  });
  if (searchEmptyBad) return fail(searchEmptyBad);

  notes.push(
    `${framework}: collection "${collectionEmpty.text}" then "${collectionError.text}"; ` +
      `picker "${pickerEmpty.text}" then "${pickerError.text}"; search "${searchEmpty.text}"; ` +
      `every loading block named "${LOADING}"`,
  );
}

$('[data-demo-case="states"]')?.scrollIntoView({ block: 'center' });
await wait(150);

return {
  verdict:
    'PASS the same empty, loading and error block on a collection, a picker and a search widget, with the caller emptyLabel shown, in both frameworks',
  notes,
  seen,
};
