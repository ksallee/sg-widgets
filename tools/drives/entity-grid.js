// Tiles carry their status over the thumbnail and no id; the arrows walk the grid and Space selects.
const notes = [];
const panes = () => $$('[data-sg-demo] [data-pane]').filter((p) => p.offsetParent !== null);
const section = (pane, id) => pane.querySelector(`[data-testid="${id}"]`);
const tilesIn = (pane, id) => [
  ...(section(pane, id)?.querySelectorAll('[data-slot="entity-card"][data-variant="tile"]') ?? []),
];
const press = (el, key) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

for (let i = 0; i < 60 && panes().some((p) => tilesIn(p, 'grid-sizes').length === 0); i += 1) await wait(250);
if (panes().length === 0) return { verdict: 'FAIL the demo rendered no pane' };

for (const pane of panes()) {
  const framework = pane.dataset.pane;
  const tiles = tilesIn(pane, 'grid-sizes');
  if (tiles.length === 0) return { verdict: `FAIL ${framework} rendered no tiles`, notes };
  notes.push(`${framework}: ${tiles.length} tiles`);

  // The thumbnail fills the top of every tile, in one of its three states.
  const states = new Set(tiles.map((t) => t.querySelector('[data-slot="thumbnail"]')?.dataset.state));
  notes.push(`${framework}: thumbnail states ${[...states].join(', ')}`);
  if (states.size === 0 || states.has(undefined)) return { verdict: `FAIL ${framework} has a tile with no thumbnail`, notes };

  // The status badge sits on the thumbnail, not under the name.
  const badged = tiles.filter((t) => t.querySelector('[data-slot="entity-card-media"] [data-slot="status-badge"]'));
  notes.push(`${framework}: ${badged.length} tiles carry a status badge over the thumbnail`);
  if (badged.length !== tiles.length) return { verdict: `FAIL ${framework} has a tile with no status badge over its thumbnail`, notes };

  // Nothing on a tile spells the row's id.
  const withId = tiles.find((t) => t.textContent.includes('#'));
  if (withId) return { verdict: `FAIL ${framework} shows a tile reading "${withId.textContent.trim()}"`, notes };
  notes.push(`${framework}: no tile text carries a # id`);

  // The arrows walk the grid from one tab stop, down by a whole row of tiles.
  const list = section(pane, 'grid-sizes').querySelector('[role="listbox"]');
  const columns = getComputedStyle(list).gridTemplateColumns.split(' ').filter((t) => t.length > 0).length;
  tiles[0].focus();
  press(tiles[0], 'ArrowRight');
  await wait(150);
  if (document.activeElement !== tiles[1]) return { verdict: `FAIL ${framework} did not move focus on ArrowRight`, notes };
  press(tiles[1], 'ArrowDown');
  await wait(150);
  const down = tiles.indexOf(document.activeElement);
  if (down !== 1 + columns) return { verdict: `FAIL ${framework} moved to tile ${down} on ArrowDown, expected ${1 + columns}`, notes };
  press(document.activeElement, 'Home');
  await wait(150);
  if (document.activeElement !== tiles[0]) return { verdict: `FAIL ${framework} did not return focus on Home`, notes };
  notes.push(`${framework}: ${columns} columns, ArrowRight to tile 1, ArrowDown to tile ${down}, Home back to tile 0`);

  // Down moves a whole row whatever the track list resolved to, so widen it and look again.
  const laid = list.style.gridTemplateColumns;
  list.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))';
  await wait(50);
  tiles[0].focus();
  press(tiles[0], 'ArrowDown');
  await wait(150);
  const wide = tiles.indexOf(document.activeElement);
  list.style.gridTemplateColumns = laid;
  if (wide !== 3) return { verdict: `FAIL ${framework} moved to tile ${wide} on ArrowDown over 3 columns`, notes };
  notes.push(`${framework}: over 3 columns ArrowDown moved a whole row`);

  // Space selects on the selectable grid.
  const selectable = tilesIn(pane, 'grid-selectable');
  if (selectable.length === 0) return { verdict: `FAIL ${framework} rendered no selectable tiles`, notes };
  selectable[0].focus();
  press(selectable[0], ' ');
  await wait(300);
  const count = section(pane, 'grid-selectable').querySelector('[data-testid="selection-count"]').textContent.trim();
  notes.push(`${framework}: selection reads ${count}`);
  if (!count.startsWith('1 ')) return { verdict: `FAIL ${framework} selection reads "${count}", expected 1`, notes };

  // Every tile of the third grid is on the placeholder.
  const placeholders = tilesIn(pane, 'grid-no-image').filter(
    (t) => t.querySelector('[data-slot="thumbnail"]')?.dataset.state === 'none',
  );
  notes.push(`${framework}: ${placeholders.length} tiles on the placeholder`);
  if (placeholders.length === 0) return { verdict: `FAIL ${framework} drew no placeholder tile`, notes };

  // Infinite scroll: reaching the end of the body asks the source for the next page.
  const before = tilesIn(pane, 'grid-sizes').length;
  const scroller = section(pane, 'grid-sizes').querySelector('[data-slot="entity-grid-scroll"]');
  for (let i = 0; i < 40 && tilesIn(pane, 'grid-sizes').length === before; i += 1) {
    scroller.scrollTop = scroller.scrollHeight;
    await wait(250);
  }
  if (tilesIn(pane, 'grid-sizes').length <= before) return { verdict: `FAIL ${framework} loaded no more than ${before} tiles`, notes };
  notes.push(`${framework}: scrolling loaded ${tilesIn(pane, 'grid-sizes').length - before} more tiles`);
  scroller.scrollTop = 0;
}

return { verdict: 'PASS status over the thumbnail, no id, arrows, Space and the placeholder', notes };
