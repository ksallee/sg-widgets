// Cards from a held row, one card that reads the row a pick names, and the tile variant.
//
//   pnpm qa --start --path /widgets/entity-card/ --framework both --drive tools/drives/entity-card.js

const notes = [];
const DOTTED = 'Link › Shot › Sequence';
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const cards = (name) => [...pane(name).querySelectorAll('[data-slot="entity-card"][data-variant="card"]')];
const tiles = (name) => [...pane(name).querySelectorAll('[data-slot="entity-card"][data-variant="tile"]')];
const labels = (name) => [...new Set([...pane(name).querySelectorAll('dt')].map((el) => el.textContent.trim()))];
const named = (card) => card.querySelector('a[target="_blank"], span[title]')?.textContent.trim() ?? '';

/** A press, the way a mouse makes one: the field opens on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

async function until(read, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(100);
  }
}

const options = () => [...document.querySelectorAll('[data-picker="entity"] [data-slot="entity-picker-option"]')];

for (let i = 0; i < 60 && cards('svelte').length + cards('react').length < 6; i += 1) await wait(250);

for (const framework of ['svelte', 'react']) {
  const held = cards(framework);
  notes.push(`${framework}: ${held.length} cards from the held row, ${tiles(framework).length} tiles`);
  if (held.length !== 3) return { verdict: `FAIL ${framework} drew ${held.length} cards from a row, expected 3`, notes };
  if (tiles(framework).length !== 4) return { verdict: `FAIL ${framework} drew ${tiles(framework).length} tiles, expected 4`, notes };
  const shown = labels(framework);
  if (!shown.includes(DOTTED)) return { verdict: `FAIL ${framework} has no "${DOTTED}" label`, notes };
  if (held.some((card) => named(card).length === 0)) return { verdict: `FAIL ${framework} left a card unnamed`, notes };

  // The reference section reads nothing until a pick names a row.
  const input = pane(framework).querySelector('[data-slot="entity-picker-input"]');
  if (!input) return { verdict: `FAIL ${framework} has no picker`, notes };
  press(input);
  const listed = await until(() => (options().length > 0 ? options() : null));
  if (!listed) return { verdict: `FAIL ${framework} listed no version to pick`, notes };
  const wanted = listed[0].textContent.trim();
  press(listed[0]);

  const read = await until(() => {
    const found = cards(framework).filter((card) => !held.includes(card));
    return found.length === 1 && named(found[0]).length > 0 ? found[0] : null;
  });
  if (!read) return { verdict: `FAIL ${framework} read no row for the pick "${wanted}"`, notes };
  notes.push(`${framework}: picking "${wanted}" read a card named "${named(read)}"`);
  if (!read.querySelector('dt')) return { verdict: `FAIL ${framework} read a row with no field values`, notes };
}

// Every tile carries its status over the thumbnail and none of them spells an id.
for (const framework of ['svelte', 'react']) {
  const all = tiles(framework);
  const badged = all.filter((t) => t.querySelector('[data-slot="entity-card-media"] [data-slot="status-badge"]'));
  if (badged.length !== all.length) return { verdict: `FAIL ${framework} has a tile with no status over its thumbnail`, notes };
  if (all.some((t) => t.textContent.includes('#'))) return { verdict: `FAIL ${framework} shows a tile carrying a # id`, notes };
  notes.push(`${framework}: ${badged.length} tiles carry a status badge over the thumbnail, none with a # id`);
}

// Leave the page on the card the pick read and the tiles under it.
const stage = $$('[data-pane]').find((p) => p.offsetParent !== null) ?? document;
stage.querySelector('[data-slot="entity-card"][data-variant="tile"]')?.scrollIntoView({ block: 'center' });
await wait(300);

return { verdict: 'PASS three cards from a row, one card read from a pick, four tiles', notes };
