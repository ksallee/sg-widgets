// Six cards, and the dotted path labelled with the type its hop travels through.
const notes = [];
const DOTTED = 'Link › Shot › Sequence';
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const cards = (name) => [...pane(name).querySelectorAll('[data-slot="entity-card"]')];
const labels = (name) => [...new Set([...pane(name).querySelectorAll('[data-slot="entity-card"] dt')].map((el) => el.textContent.trim()))];
const names = (name) =>
  cards(name)
    .map((card) => card.querySelector('a[target="_blank"], span[title]'))
    .map((el) => (el ? el.textContent.trim() : ''))
    .filter(Boolean);

for (let i = 0; i < 60 && cards('svelte').length + cards('react').length < 12; i += 1) await wait(250);

for (const framework of ['svelte', 'react']) {
  const count = cards(framework).length;
  const shown = labels(framework);
  const named = names(framework);
  notes.push(`${framework}: ${count} cards, labels ${shown.join(' | ')}`);
  if (count !== 6) return { verdict: `FAIL ${framework} drew ${count} cards, expected 6`, notes };
  if (!shown.includes(DOTTED)) return { verdict: `FAIL ${framework} has no "${DOTTED}" label`, notes };
  if (named.length !== count || named.some((n) => n.length === 0)) {
    return { verdict: `FAIL ${framework} left a card unnamed`, notes };
  }
  notes.push(`${framework}: named ${[...new Set(named)].join(', ')}`);
}

return { verdict: `PASS six cards per framework, every one named, dotted label "${DOTTED}"`, notes };
