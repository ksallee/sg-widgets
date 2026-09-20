// The docs column, the install tabs and the framework pick they share.
//
//   pnpm qa --start --viewport 1600x1000 --path /widgets/entity-type-multi-picker/ \
//     --drive tools/drives/docs-column.js
//
// 1600 wide, so the pane has room for the whole 50rem column; below that the column is
// what fits. The page is the one carrying the longest install line.
const fails = [];
const notes = [];
const round = (v) => Math.round(v);

const markdown = $('.sl-markdown-content');
const container = markdown.closest('.sl-container');
const pane = $('.main-pane');
const box = container.getBoundingClientRect();
const paneBox = pane.getBoundingClientRect();

const columnWidth = round(box.width);
if (columnWidth !== 800) fails.push(`column ${columnWidth}px, expected 800 (50rem)`);

const left = round(box.left - paneBox.left);
const right = round(paneBox.right - box.right);
if (Math.abs(left - right) > 2) fails.push(`column off centre in its pane: ${left}px left, ${right}px right`);

// Prose, install block and demo all stand at the column's width.
const prose = round($('.sl-markdown-content > p').getBoundingClientRect().width);
if (prose !== columnWidth) fails.push(`prose ${prose}px, column ${columnWidth}px`);
const install = round($('[data-sg-install]').getBoundingClientRect().width);
if (install !== columnWidth) fails.push(`install block ${install}px, column ${columnWidth}px`);
const demo = round($('[data-sg-demo]').getBoundingClientRect().width);
if (demo !== columnWidth) fails.push(`demo ${demo}px, column ${columnWidth}px`);

// The Both segment and the two-pane stage are gone without PUBLIC_SG_DEMO_BOTH.
if ($('[data-framework-pick="both"]')) fails.push('the Both segment is on the toolbar');
if ($('[data-sg-demo]').dataset.framework === 'both') fails.push('the stage opened on both panes');

/** What the visible install command needs, against the room the column gives it. */
function measure(framework) {
  const pre = $(`[data-install-pane="${framework}"] pre`);
  return {
    framework,
    font: getComputedStyle(pre.querySelector('code') ?? pre).fontSize,
    characters: pre.textContent.trim().length,
    room: round(pre.clientWidth),
    needs: round(pre.scrollWidth),
    scrolls: round(pre.scrollWidth - pre.clientWidth),
  };
}

const commands = [measure('react')];

// A tab writes the pick every demo reads.
$('[data-install-pick="svelte"]').click();
await wait(100);
const stored = localStorage.getItem('sg-demo:framework');
if (stored !== 'svelte') fails.push(`the tab stored ${stored}`);
if (document.documentElement.dataset.sgFramework !== 'svelte') fails.push('the root did not follow the tab');
if ($('[data-sg-demo]').dataset.framework !== 'svelte') fails.push('the demo did not follow the tab');
if ($('[data-framework-pick="svelte"]').getAttribute('aria-pressed') !== 'true') {
  fails.push('the toolbar segment did not follow the tab');
}
if (getComputedStyle($('[data-install-pane="react"]')).display !== 'none') {
  fails.push('the React install pane stayed on show');
}

commands.push(measure('svelte'));

// A toolbar segment moves the tabs back.
$('[data-framework-pick="react"]').click();
await wait(100);
if ($('[data-install-pick="react"]').getAttribute('aria-pressed') !== 'true') {
  fails.push('the install tab did not follow the toolbar segment');
}

for (const command of commands) {
  if (command.scrolls > 0) {
    notes.push(
      `the ${command.framework} install line (${command.characters} characters) overruns the column by ${command.scrolls}px and scrolls`,
    );
  }
}

const verdict = fails.length
  ? `FAIL ${fails.join('; ')}`
  : `PASS one 50rem column, centred in its pane; prose, install and demo share it; no Both segment; a tab and a toolbar segment share the pick${
      notes.length ? `. Measured: ${notes.join('; ')}` : '; no install line scrolls'
    }`;

return { verdict, columnWidth, gaps: { left, right }, commands };
