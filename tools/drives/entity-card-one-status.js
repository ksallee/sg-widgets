// A card asked for its own status field draws one badge, not two.
//
//   pnpm qa --start --path /widgets/entity-card/ --framework both --drive tools/drives/entity-card-one-status.js
//
// The demo names `sg_status_list` among its paths. The header badge is the one truth, so
// the grid holds no Status row, and no card carries two badges.

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const cards = (name) => [...pane(name).querySelectorAll('[data-slot="entity-card"][data-variant="card"]')];
/**
 * The panes this run shows. Both islands stay mounted whichever framework the toolbar
 * is on, and a hidden pane never loads its images, so only a visible one is read.
 */
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };
for (let i = 0; i < 60 && drawn.reduce((n, f) => n + cards(f).length, 0) < drawn.length * 3; i += 1) await wait(250);

for (const framework of drawn) {
  const held = cards(framework);
  if (held.length < 3) return { verdict: `FAIL ${framework} drew ${held.length} cards, expected 3`, notes };
  for (const card of held) {
    const badges = card.querySelectorAll('[data-slot="status-badge"]');
    if (badges.length !== 1) {
      return { verdict: `FAIL ${framework} drew ${badges.length} status badges on one card, expected 1`, notes };
    }
    const rows = [...card.querySelectorAll('dd')].filter((dd) => dd.dataset.dataType === 'status_list');
    if (rows.length !== 0) {
      return { verdict: `FAIL ${framework} drew a status row in the grid beside the header badge`, notes };
    }
  }
  const labels = [...new Set([...pane(framework).querySelectorAll('dt')].map((el) => el.textContent.trim()))];
  notes.push(`${framework}: ${held.length} cards, one badge each, grid labels ${labels.join(' | ')}`);
  if (labels.includes('Status')) return { verdict: `FAIL ${framework} still labels a Status row in the grid`, notes };
  // The linked row's status is a different row's and is still drawn.
  if (!labels.includes('Link › Shot › Sequence')) {
    return { verdict: `FAIL ${framework} lost the dotted path the demo names`, notes };
  }
}

// Leave the cards in view, which is what a shot taken with this drive reads.
document.querySelector('[data-pane] [data-slot="entity-card"][data-variant="card"]')?.scrollIntoView({ block: 'center' });
await wait(400);

return { verdict: 'PASS every card draws one status, in its header, and no Status row in the grid', notes };
