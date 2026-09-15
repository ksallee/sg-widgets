// The empty thumbnail draws its row's glyph, and a card draws one status.
//
//   pnpm qa --start --path /widgets/thumbnail/ --framework both --drive tools/drives/thumbnail-empty.js
//
// Read on the thumbnail page: every cell with no picture, and every one whose URL failed,
// carries a glyph that is not the crossed-out picture, and the four named types draw four
// different ones. The card half of the drive runs on /widgets/entity-card/ instead.

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
/**
 * The panes this run shows. Both islands stay mounted whichever framework the toolbar
 * is on, and a hidden pane never loads its images, so only a visible one is read.
 */
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);

/** The lucide icon inside a thumbnail, by the name lucide puts in its class list. */
function glyphName(thumb) {
  const svg = thumb.querySelector('[role="img"] svg');
  if (!svg) return null;
  const found = [...svg.classList].find((c) => c.startsWith('lucide-') && c !== 'lucide-icon');
  return found ? found.slice('lucide-'.length) : null;
}

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };

for (let i = 0; i < 60; i += 1) {
  if (drawn.every((f) => pane(f).querySelectorAll('[data-slot="thumbnail"]').length >= 10)) break;
  await wait(250);
}

for (const framework of drawn) {
  const all = [...pane(framework).querySelectorAll('[data-slot="thumbnail"]')];
  const empty = all.filter((t) => t.dataset.state === 'none');
  notes.push(`${framework}: ${all.length} thumbnails, ${empty.length} with no picture`);
  if (empty.length < 5) return { verdict: `FAIL ${framework} drew ${empty.length} empty thumbnails, expected at least 5`, notes };

  const names = empty.map(glyphName);
  if (names.some((n) => n === null)) return { verdict: `FAIL ${framework} drew an empty thumbnail with no glyph`, notes };
  const off = names.filter((n) => n === 'image-off');
  if (off.length > 0) return { verdict: `FAIL ${framework} still draws image-off in ${off.length} empty thumbnails`, notes };

  // The typed cells: a Shot, an Asset, a Version and a Task, each its own glyph, plus the
  // untyped one that falls back to a plain picture.
  const distinct = new Set(names);
  notes.push(`${framework}: empty glyphs ${[...distinct].sort().join(', ')}`);
  if (!distinct.has('image')) return { verdict: `FAIL ${framework} draws no plain picture where no type was given`, notes };
  for (const wanted of ['clapperboard', 'box', 'video', 'list-checks']) {
    if (!distinct.has(wanted)) return { verdict: `FAIL ${framework} draws no ${wanted} for the type that owns it`, notes };
  }
  // The transcoding state keeps its own glyph.
  const pending = all.filter((t) => t.dataset.state === 'pending').map(glyphName);
  if (pending.length === 0 || pending.some((n) => n !== 'hourglass')) {
    return { verdict: `FAIL ${framework} lost the transcoding hourglass: ${pending.join(', ')}`, notes };
  }
  notes.push(`${framework}: ${pending.length} transcoding thumbnails still on the hourglass`);
}

// Drawn together, the two frameworks hold the same glyph for the same cell.
const per = (f) =>
  [...pane(f).querySelectorAll('[data-slot="thumbnail"]')].map((t) => `${t.dataset.state}:${glyphName(t) ?? '-'}`).join(' ');
if (drawn.length === 2 && per('svelte') !== per('react')) {
  return { verdict: 'FAIL the two frameworks drew different thumbnail states', notes, svelte: per('svelte'), react: per('react') };
}

// Leave the states section in view, which is what a shot taken with this drive reads.
document.querySelector('[data-pane] [data-slot="thumbnail"][data-state="none"]')?.scrollIntoView({ block: 'center' });
await wait(400);

return { verdict: `PASS no empty thumbnail draws a broken picture; the typed ones draw their own glyph and both frameworks agree`, notes };
