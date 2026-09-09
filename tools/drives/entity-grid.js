// Select two cards, then scroll to the end and let the source load the next page.
const notes = [];
const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const cards = () => [...pane().querySelectorAll('[data-slot="entity-grid-card"]')];

for (let i = 0; i < 40 && cards().length === 0; i += 1) await wait(250);
if (cards().length === 0) return { verdict: 'FAIL the grid rendered no cards' };
notes.push(`cards: ${cards().length}`);

// Every card carries a thumbnail in one of its three states.
const states = new Set(cards().map((c) => c.querySelector('[data-slot="thumbnail"]')?.dataset.state));
notes.push(`thumbnail states: ${[...states].join(', ')}`);
if (states.size === 0 || states.has(undefined)) return { verdict: 'FAIL a card has no thumbnail', notes };

const boxes = cards().map((c) => c.querySelector('[data-slot="checkbox"]'));
boxes[0].click();
boxes[1].click();
await wait(300);
const count = pane().querySelector('[data-testid="selection-count"]').textContent.trim();
notes.push(`selection: ${count}`);
if (!count.startsWith('2 ')) return { verdict: `FAIL selection reads "${count}", expected 2`, notes };

// Infinite scroll: reaching the end of the body asks the source for the next page.
const before = cards().length;
const scroller = pane().querySelector('[data-slot="entity-grid-scroll"]');
scroller.scrollTop = scroller.scrollHeight;
for (let i = 0; i < 40 && cards().length === before; i += 1) {
  scroller.scrollTop = scroller.scrollHeight;
  await wait(250);
}
if (cards().length <= before) return { verdict: `FAIL scrolling loaded no more than ${before} cards`, notes };
notes.push(`scrolling to the end loaded ${cards().length - before} more cards`);

return { verdict: 'PASS thumbnails, selection and infinite scroll', notes };
