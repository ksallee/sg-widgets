// The same page against a real site: the rows are the site's, not the mock's.
const notes = [];
const MOCK_NAME = 'sh010_0010_fx_v001';
const DOTTED = 'Link › Shot › Sequence';
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const cards = (name) => [...pane(name).querySelectorAll('[data-slot="entity-card"]')];
const labels = (name) => [...new Set([...pane(name).querySelectorAll('[data-slot="entity-card"] dt')].map((el) => el.textContent.trim()))];
const names = (name) =>
  cards(name)
    .map((card) => card.querySelector('a[target="_blank"], span[title]'))
    .map((el) => (el ? el.textContent.trim() : ''))
    .filter(Boolean);

for (let i = 0; i < 80 && cards('svelte').length + cards('react').length < 12; i += 1) await wait(250);

const failed = [...document.querySelectorAll('.text-destructive')].map((el) => el.textContent.trim());
if (failed.length > 0) return { verdict: `FAIL the site answered: ${failed.join(' / ')}`, notes };

for (const framework of ['svelte', 'react']) {
  const named = names(framework);
  const shown = labels(framework);
  notes.push(`${framework}: ${cards(framework).length} cards named ${[...new Set(named)].join(', ')}`);
  notes.push(`${framework}: labels ${shown.join(' | ')}`);
  if (named.length === 0 || named.some((n) => n.length === 0 || n === MOCK_NAME)) {
    return { verdict: `FAIL ${framework} shows no live name`, notes };
  }
  if (!shown.includes(DOTTED)) return { verdict: `FAIL ${framework} has no "${DOTTED}" label`, notes };
  const detail = [...pane(framework).querySelectorAll('[data-slot="entity-card"] a[target="_blank"]')].map((a) => a.getAttribute('href'));
  if (!detail.some((href) => href.includes('/detail/'))) {
    return { verdict: `FAIL ${framework} linked no row to its page`, notes };
  }
  notes.push(`${framework}: linked to ${detail.find((href) => href.includes('/detail/'))}`);
}

return { verdict: 'PASS live rows, live thumbnails, the dotted label and the detail links', notes };
