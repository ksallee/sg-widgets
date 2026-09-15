// Every row of a props table carries an id, and an inherited row's link lands on that
// row's own id on the page of the item that declares it.
//
//   pnpm qa --start --path /widgets/user-multi-picker/ --drive tools/drives/props-tables.js

const failures = [];
const seen = {};

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

const pages = new Map();

async function idsOn(path) {
  if (!pages.has(path)) {
    const doc = await frame(path);
    pages.set(
      path,
      new Set([...doc.querySelectorAll('[data-props] tbody tr')].map((row) => row.id)),
    );
  }
  return pages.get(path);
}

for (const table of $$('table[data-props]')) {
  const item = table.dataset.props;
  const kind = table.dataset.propsKind;
  const key = `${item}/${kind}`;
  const rows = [...table.querySelectorAll('tbody tr')];
  const ids = new Set();
  let own = 0;
  let inherited = 0;

  for (const row of rows) {
    const name = row.querySelector('td')?.textContent.trim() ?? '?';
    if (!row.id) failures.push(`${key}: the row for ${name} carries no id`);
    if (ids.has(row.id)) failures.push(`${key}: two rows carry the id ${row.id}`);
    ids.add(row.id);

    const link = row.querySelector('a.sg-props-from');
    if (!link) {
      own++;
      if (row.dataset.propsOwner !== item)
        failures.push(`${key}: ${name} comes from ${row.dataset.propsOwner} and links nowhere`);
      continue;
    }
    inherited++;
    if (!/^from [A-Z]/.test(link.textContent.trim()))
      failures.push(`${key}: ${name} says "${link.textContent.trim()}" instead of naming its page`);
    const href = new URL(link.getAttribute('href'), location.href);
    const target = href.hash.slice(1);
    const there = await idsOn(href.pathname);
    if (!there.has(target))
      failures.push(`${key}: ${name} points at ${href.pathname}#${target}, which is not there`);
  }

  if (rows.length !== own + inherited)
    failures.push(`${key}: ${rows.length} rows, ${own} own and ${inherited} inherited`);
  seen[key] = { rows: rows.length, own, inherited };
}

if (Object.keys(seen).length === 0) failures.push('the page draws no props table');

return {
  verdict:
    failures.length === 0
      ? `PASS every row has an id and every inherited row lands on its own row upstream (${Object.keys(seen).length} tables)`
      : `FAIL ${failures.join('; ')}`,
  seen,
};
