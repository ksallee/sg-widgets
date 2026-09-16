// A card's field label and its value sit on one baseline, in both frameworks.
//
//   pnpm qa --start --path /widgets/entity-card/ --framework both --drive tools/drives/entity-card-baseline.js

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const cards = (name) => [...pane(name).querySelectorAll('[data-slot="entity-card"][data-variant="card"]')];

/**
 * The y of the baseline the element's first text sits on. A zero-height inline-block at
 * `vertical-align: baseline` puts its own bottom edge on that baseline, which reads the same
 * whatever size the text is; a text node's client rect does not.
 */
function baseline(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = null;
  while ((node = walker.nextNode())) if (node.nodeValue.trim().length > 0) break;
  if (!node) return null;
  const wrap = document.createElement('span');
  const probe = document.createElement('span');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  node.parentNode.insertBefore(wrap, node);
  wrap.append(probe, node);
  const y = probe.getBoundingClientRect().bottom;
  wrap.replaceWith(node);
  return y;
}

for (let i = 0; i < 60 && cards('svelte').length + cards('react').length < 6; i += 1) await wait(250);

let worst = { delta: 0, label: '', framework: '' };
for (const framework of ['svelte', 'react']) {
  const rows = [];
  for (const card of cards(framework)) {
    const dts = [...card.querySelectorAll('dt')];
    const dds = [...card.querySelectorAll('dd')];
    if (dts.length === 0) return { verdict: `FAIL ${framework} drew a card with no field rows`, notes };
    for (let i = 0; i < dts.length; i += 1) {
      const label = baseline(dts[i]);
      const value = baseline(dds[i]);
      if (label === null || value === null) continue;
      const delta = Math.abs(label - value);
      rows.push({ label: dts[i].textContent.trim(), delta: Number(delta.toFixed(2)) });
      if (delta > worst.delta) worst = { delta, label: dts[i].textContent.trim(), framework };
    }
  }
  if (rows.length === 0) return { verdict: `FAIL ${framework} read no label and value pair`, notes };
  notes.push(`${framework}: ${rows.length} rows read, worst ${Math.max(...rows.map((r) => r.delta))}px`);
  notes.push(`${framework}: ${rows.map((r) => `${r.label} ${r.delta}px`).join(', ')}`);
}

if (worst.delta > 1) {
  return { verdict: `FAIL "${worst.label}" sits ${worst.delta.toFixed(2)}px off its value in ${worst.framework}`, notes };
}
return { verdict: `PASS every label and value share a baseline, worst ${worst.delta.toFixed(2)}px`, notes };
