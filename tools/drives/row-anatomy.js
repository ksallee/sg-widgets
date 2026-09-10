// One row anatomy across the search widgets and the tree: a picture, a highlighted
// label, a sub-label and a typed secondary, and a tree checkbox that is the shared
// primitive rather than a hand-drawn box.
//
//   pnpm qa --start --path /widgets/global-search/ --framework both --drive tools/drives/row-anatomy.js
//
// The hierarchical search and the tree live on their own pages, opened here in a
// same-origin iframe so the three widgets are read in one run.
const notes = [];
const fail = (m) => ({ verdict: 'FAIL ' + m, notes });

function type(input, text) {
  const proto = Object.getPrototypeOf(input);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter ? setter.call(input, text) : (input.value = text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function until(fn, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(50);
  }
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

/** What one row draws, read off the shared row's slots. */
function anatomy(row) {
  const leading = row.querySelector('[data-slot="picker-row-leading"]');
  return {
    leading: Boolean(leading),
    picture: Boolean(leading?.querySelector('[data-slot="thumbnail"], [data-slot="user-avatar"]')),
    name: row.querySelector('[data-slot="picker-row-name"]')?.textContent.trim() ?? '',
    bold: row.querySelectorAll('[data-slot="picker-row-name"] .font-semibold').length,
    sub: row.querySelector('[data-slot="picker-row-sub-label"]')?.textContent.trim() ?? '',
    badge: Boolean(row.querySelector('[data-slot="picker-row-secondary"] [data-slot="status-badge"]')),
  };
}

function check(where, seen, wants) {
  const bad = [];
  if (!seen.leading) bad.push('no leading slot');
  if (!seen.picture) bad.push('no picture');
  if (!seen.name.includes(wants.name)) bad.push(`label reads "${seen.name}"`);
  if (seen.bold === 0) bad.push('nothing highlighted in the label');
  if (!seen.sub.startsWith(wants.sub)) bad.push(`sub-label reads "${seen.sub}"`);
  if (!seen.badge) bad.push('the secondary is not a status badge');
  return bad.length === 0 ? null : `${where}: ${bad.join('; ')}`;
}

const seen = {};

for (const framework of ['svelte', 'react']) {
  /* 1. Global search, on the demo that names a sub-label field and a secondary field. */
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) return fail(`no ${framework} pane`);
  const box = $('[data-demo="anatomy"]', pane);
  if (!box) return fail(`${framework}: no row-anatomy demo`);
  const input = $('input[data-slot="command-input"]', box);
  type(input, 'sh010');
  const rows = await until(() => {
    const found = $$('[data-slot="command-item"][data-entity-type="Shot"]', box);
    return found.length > 0 ? found : null;
  });
  if (!rows) return fail(`${framework}: the global search returned nothing for "sh010"`);
  const global = anatomy(rows[0]);
  seen[`${framework} global search`] = global;
  const globalBad = check(`${framework} global search`, global, { name: 'sh010', sub: 'Shot ' });
  if (globalBad) return fail(globalBad);

  /* 2. Hierarchical search, in its own page. */
  const doc = await frame('/widgets/hierarchical-search/');
  const other = doc.querySelector(`[data-pane="${framework}"]`);
  if (!other) return fail(`${framework}: no pane on the hierarchical search page`);
  const treeInput = await until(() => other.querySelector('input[data-slot="command-input"]'));
  if (!treeInput) return fail(`${framework}: the hierarchical search never rendered`);
  type(treeInput, 'sh010_0010');
  const hit = await until(() => other.querySelector('[data-slot="command-item"][data-entity-type="Shot"]'));
  if (!hit) return fail(`${framework}: the hierarchical search returned no shot for "sh010_0010"`);
  const hierarchical = anatomy(hit);
  hierarchical.crumbs = hit.querySelector('[data-slot="picker-row-label"]')?.getAttribute('title') ?? '';
  seen[`${framework} hierarchical search`] = hierarchical;
  const hierarchicalBad = check(`${framework} hierarchical search`, hierarchical, {
    name: 'sh010_0010',
    sub: 'Shot',
  });
  if (hierarchicalBad) return fail(hierarchicalBad);
  if (!hierarchical.crumbs.includes('›')) {
    return fail(`${framework} hierarchical search: the label is not a breadcrumb: "${hierarchical.crumbs}"`);
  }

  /* 3. The tree's checkbox is the shared primitive. */
  const treeDoc = await frame('/widgets/entity-tree/');
  const treePane = treeDoc.querySelector(`[data-pane="${framework}"]`);
  if (!treePane) return fail(`${framework}: no pane on the tree page`);
  const boxes = await until(() => {
    const found = [...treePane.querySelectorAll('[data-slot="entity-tree-checkbox"]')];
    return found.length > 0 ? found : null;
  });
  if (!boxes) return fail(`${framework}: the tree drew no checkbox`);
  const shared = boxes.filter((b) => b.querySelector('[data-slot="checkbox"]')).length;
  seen[`${framework} tree`] = { boxes: boxes.length, shared };
  if (shared !== boxes.length) {
    return fail(`${framework} tree: ${boxes.length - shared} of ${boxes.length} boxes are not the shared checkbox`);
  }

  notes.push(
    `${framework}: global search "${global.name}" / "${global.sub}" with a badge; ` +
      `hierarchical "${hierarchical.crumbs}" / "${hierarchical.sub}" with a badge; ` +
      `${shared} tree checkboxes, all the shared primitive`,
  );
}

// Put the global search results back in the viewport for the screenshot.
$('[data-demo="anatomy"]')?.scrollIntoView({ block: 'center' });
await wait(150);

return {
  verdict:
    'PASS both search widgets draw the picker row with a picture, a highlighted label, a sub-label and a status secondary, and every tree checkbox is the shared primitive, in both frameworks',
  notes,
  seen,
};
