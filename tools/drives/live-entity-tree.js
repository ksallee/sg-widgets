// The same tree against a real site: the levels are the site's navigation configuration.
const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const tree = (name) => pane(name).querySelectorAll('[data-slot="entity-tree"]')[0];
const items = (name) => [...tree(name).querySelectorAll('[role="treeitem"]')];
const labelOf = (node) => node?.querySelector('[data-slot="entity-tree-label"]')?.textContent.trim();

for (let i = 0; i < 80 && items('svelte').length + items('react').length < 4; i += 1) await wait(250);

const failed = [...document.querySelectorAll('.text-destructive')].map((el) => el.textContent.trim());
if (failed.length > 0) return { verdict: `FAIL the site answered: ${failed.join(' / ')}`, notes };

for (const framework of ['svelte', 'react']) {
  const top = items(framework);
  if (top.length < 2) return { verdict: `FAIL ${framework} loaded ${top.length} nodes`, notes };
  const root = top[0];
  if (!root.dataset.path.startsWith('/Project/')) {
    return { verdict: `FAIL ${framework} rooted the tree at ${root.dataset.path}`, notes };
  }
  notes.push(`${framework}: "${labelOf(root)}" holds ${top.slice(1).map(labelOf).join(', ')}`);

  // Open the first folder under the project and read what the site put there.
  const folder = top.find((n) => n.getAttribute('aria-expanded') === 'false');
  if (!folder) return { verdict: `FAIL ${framework} offered no branch to open`, notes };
  const before = top.length;
  folder.click();
  for (let i = 0; i < 80 && items(framework).length === before; i += 1) await wait(250);
  const opened = items(framework);
  if (opened.length === before) return { verdict: `FAIL ${framework} opened "${labelOf(folder)}" and got nothing`, notes };
  const level = opened.filter((n) => n.dataset.path.startsWith(`${folder.dataset.path}/`));
  notes.push(
    `${framework}: "${labelOf(folder)}" opened ${level.length} nodes, first "${labelOf(level[0])}" at level ${level[0]?.getAttribute('aria-level')}`,
  );
  // One level deeper, where the site's own rows live.
  const under = level.find((n) => n.getAttribute('aria-expanded') === 'false') ?? level[0];
  const was = items(framework).length;
  under.click();
  for (let i = 0; i < 80 && items(framework).length === was; i += 1) await wait(250);
  const rows = items(framework).filter((n) => n.dataset.path.startsWith(`${under.dataset.path}/`));
  notes.push(`${framework}: "${labelOf(under)}" opened ${rows.map(labelOf).slice(0, 4).join(', ')}`);
  // The status field of each type is one schema read behind the level.
  for (let i = 0; i < 40 && tree(framework).querySelectorAll('[data-slot="status-badge"]').length === 0; i += 1) {
    await wait(250);
  }
  const badges = tree(framework).querySelectorAll('[data-slot="status-badge"]');
  notes.push(
    `${framework}: ${badges.length} rows carry a status badge, first ${badges[0]?.getAttribute('data-status-code') ?? 'none'}`,
  );

  // A row the site holds, searched for by a word of its own label: the search places it.
  const wanted = labelOf(rows[0] ?? level[0]);
  const word = (wanted ?? '').split(/[\s_]+/).filter((part) => part.length > 2).pop();
  if (!word) return { verdict: `${framework}: no word to search for in "${wanted}"`, notes };
  const shut = tree(framework).querySelector('[role="treeitem"]');
  shut.click();
  await wait(500);
  const search = pane(framework).querySelector('[data-slot="entity-tree-search"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, word);
  search.dispatchEvent(new Event('input', { bubbles: true }));
  const found = () => items(framework).filter((n) => n.querySelector('[data-slot="entity-tree-label"] .font-semibold'));
  for (let i = 0; i < 120 && found().length === 0; i += 1) await wait(250);
  if (found().length === 0) return { verdict: `FAIL ${framework} searched "${word}" and placed nothing`, notes };
  notes.push(`${framework}: searching "${word}" placed ${found().length} rows, first "${labelOf(found()[0])}"`);
}

return { verdict: 'PASS live nodes under a live project, opened one level at a time and searched', notes };
