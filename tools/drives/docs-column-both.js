// The two-pane stage, behind PUBLIC_SG_DEMO_BOTH.
//
//   PUBLIC_SG_DEMO_BOTH=1 pnpm qa --start --viewport 1600x1000 --framework both \
//     --path /widgets/status-badge/ --drive tools/drives/docs-column-both.js
const demo = $('[data-sg-demo]');
const fails = [];
if (!$('[data-framework-pick="both"]')) fails.push('no Both segment');
if (demo.dataset.framework !== 'both') fails.push(`stage on ${demo.dataset.framework}`);
const panes = $$('[data-pane]').filter((pane) => getComputedStyle(pane).display !== 'none');
if (panes.length !== 2) fails.push(`${panes.length} panes on show`);
const column = Math.round($('.sl-markdown-content').closest('.sl-container').getBoundingClientRect().width);
if (column <= 800) fails.push(`column ${column}px, expected the wide one`);
return {
  verdict: fails.length ? `FAIL ${fails.join('; ')}` : `PASS Both is back: two panes in a ${column}px column`,
  column,
};
