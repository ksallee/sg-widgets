// The state line demo: both states drawn, the caller's label and glyph on each, and
// the inset the padding asked for.
//
//   pnpm qa --start --path /widgets/state-line/ --framework both --drive tools/drives/state-line-demo.js

const failures = [];
const seen = {};

/** The line every empty and error state wears, per rule 5 of the design rules. */
const LINE = ['flex', 'items-center', 'justify-center', 'gap-1.5', 'text-center', 'text-sm'];

/** What each case draws, in the order the page draws it. */
const CASES = [
  {
    name: 'popover',
    lines: [
      { state: 'empty', slot: 'state-line', label: 'No department matches', classes: ['text-muted-foreground', 'py-6'], without: ['py-10'] },
      { state: 'error', slot: 'state-line', label: 'The read was refused', classes: ['text-destructive', 'py-6'], without: ['py-10'] },
    ],
  },
  {
    name: 'table',
    lines: [
      { state: 'empty', slot: 'state-line', label: 'No shot in this window', classes: ['text-muted-foreground', 'py-10'], without: ['py-6'] },
      { state: 'error', slot: 'state-line', label: 'The read timed out', classes: ['text-destructive', 'py-10'], without: ['py-6'] },
    ],
  },
  {
    name: 'under-rows',
    lines: [
      { state: 'error', slot: 'state-line-page-error', label: 'The next page did not arrive', classes: ['text-destructive', 'p-2'], without: ['py-6', 'py-10'] },
    ],
  },
];

/** What one line reads and wears. */
function block(el) {
  const glyph = el.querySelector('svg');
  return {
    slot: el.getAttribute('data-slot') ?? '',
    state: el.getAttribute('data-state') ?? '',
    text: el.textContent.trim(),
    title: el.querySelector('span')?.getAttribute('title') ?? '',
    glyph: glyph ? glyph.getAttribute('class') ?? '' : null,
    classes: el.className.toString().split(/\s+/).filter(Boolean),
  };
}

function check(where, seenLine, wants) {
  const bad = [];
  for (const cls of [...LINE, ...wants.classes]) {
    if (!seenLine.classes.includes(cls)) bad.push(`no ${cls}`);
  }
  for (const cls of wants.without) {
    if (seenLine.classes.includes(cls)) bad.push(`carries ${cls}, which belongs to another pad`);
  }
  if (seenLine.state !== wants.state) bad.push(`data-state is "${seenLine.state}", wanted "${wants.state}"`);
  if (seenLine.slot !== wants.slot) bad.push(`data-slot is "${seenLine.slot}", wanted "${wants.slot}"`);
  if (seenLine.text !== wants.label) bad.push(`reads "${seenLine.text}", wanted "${wants.label}"`);
  if (seenLine.title !== wants.label) bad.push(`the title is "${seenLine.title}", wanted the whole label`);
  if (seenLine.glyph === null) bad.push('no glyph in front of the line');
  else if (!seenLine.glyph.split(/\s+/).includes('size-4')) bad.push(`the glyph wears "${seenLine.glyph}", wanted size-4`);
  return bad.length === 0 ? null : `${where}: ${bad.join('; ')}`;
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  seen[framework] = {};

  for (const group of CASES) {
    const box = $(`[data-demo-case="${group.name}"]`, pane);
    if (!box) {
      failures.push(`${framework}/${group.name}: no such case on the page`);
      continue;
    }
    const lines = $$('[data-state]', box).filter((el) => el.hasAttribute('data-slot'));
    if (lines.length !== group.lines.length) {
      failures.push(`${framework}/${group.name}: drew ${lines.length} lines, wanted ${group.lines.length}`);
      continue;
    }
    seen[framework][group.name] = lines.map(block);
    group.lines.forEach((wants, index) => {
      const bad = check(`${framework}/${group.name}/${wants.state}`, seen[framework][group.name][index], wants);
      if (bad) failures.push(bad);
    });
  }
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$('[data-demo-case="popover"]')?.scrollIntoView({ block: 'center' });
await wait(200);

return {
  verdict:
    failures.length === 0
      ? 'PASS the empty and error line, with the caller label and glyph, at the popup, body and none insets, in both frameworks'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
