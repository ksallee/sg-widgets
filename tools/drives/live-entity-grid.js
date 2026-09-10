// The same page against a real site: at least one tile shows a thumbnail the site served.
const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const tiles = (name) => [...pane(name).querySelectorAll('[data-slot="entity-card"][data-variant="tile"]')];
const loaded = (name) =>
  tiles(name)
    .map((tile) => tile.querySelector('[data-slot="thumbnail"][data-state="ready"] img'))
    .filter((img) => img && img.complete && img.naturalWidth > 0);

for (let i = 0; i < 80 && tiles('svelte').length + tiles('react').length < 12; i += 1) await wait(250);

const failed = [...document.querySelectorAll('.text-destructive')].map((el) => el.textContent.trim());
if (failed.length > 0) return { verdict: `FAIL the site answered: ${failed.join(' / ')}`, notes };

for (const framework of ['svelte', 'react']) {
  const all = tiles(framework);
  notes.push(`${framework}: ${all.length} tiles`);
  if (all.length === 0) return { verdict: `FAIL ${framework} rendered no tiles`, notes };
  for (let i = 0; i < 40 && loaded(framework).length === 0; i += 1) await wait(250);
  const pictures = loaded(framework);
  notes.push(`${framework}: ${pictures.length} tiles show a picture the site served`);
  if (pictures.length === 0) return { verdict: `FAIL ${framework} loaded no live thumbnail`, notes };
  const states = new Set(all.map((t) => t.querySelector('[data-slot="thumbnail"]')?.dataset.state));
  notes.push(`${framework}: thumbnail states ${[...states].join(', ')}`);
  const badges = all.filter((t) => t.querySelector('[data-slot="entity-card-media"] [data-slot="status-badge"]')).length;
  notes.push(`${framework}: ${badges} tiles carry a status badge over the thumbnail`);
}

return { verdict: 'PASS live rows with real thumbnails on the tiles', notes };
