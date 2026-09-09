// Open the header popover and measure the site field and the status line.
const trigger = $('[data-connect-trigger]');
if (!trigger) return { verdict: 'FAIL no Connect trigger in the header' };
if ($('[data-sg-bar]')) return { verdict: 'FAIL the strip under the header is still there' };

const out = {};
out.paletteInHeader = Boolean($('.sg-palette select'));
out.themeSelectInHeader = Boolean($('starlight-theme-select select'));
out.toolbars = $$('[data-sg-toolbar]').length;
out.toolbarHasDarkToggle = Boolean($('[data-sg-toolbar] [data-theme-toggle]'));
out.toolbarControls = $$('[data-sg-toolbar] [data-framework-pick]').map((b) => b.textContent.trim());
out.toolbarHasMotion = Boolean($('[data-sg-toolbar] [data-motion-toggle]'));
out.toolbarHasRadius = Boolean($('[data-sg-toolbar] [data-radius-pick]'));
out.toolbarHasPalette = Boolean($('[data-sg-toolbar] select[data-palette-pick]'));

trigger.click();
await wait(300);

const panel = $('#sg-connect-panel');
out.panelOpen = getComputedStyle(panel).display !== 'none';
const panelBox = panel.getBoundingClientRect();
out.panelWithinViewport = panelBox.right <= window.innerWidth + 1 && panelBox.left >= -1;

const site = $('[data-live-site]');
out.siteClientWidth = site.clientWidth;
out.siteScrollWidth = site.scrollWidth;

const status = $('[data-live-status]');
out.statusText = status.textContent.trim();
out.statusClientWidth = status.clientWidth;
out.statusScrollWidth = status.scrollWidth;

// Nothing in the panel truncates: every element renders at its full width.
const overflowing = $$('#sg-connect-panel *')
  .filter((el) => el.scrollWidth > el.clientWidth + 1)
  .map((el) => el.tagName + '.' + el.className + ' ' + el.scrollWidth + '>' + el.clientWidth);
out.overflowing = overflowing;

out.stageDark = $('[data-stage]').classList.contains('dark');
out.rootTheme = document.documentElement.dataset.theme;
out.sgTheme = localStorage.getItem('sg-demo:theme');

const fails = [];
if (!out.paletteInHeader) fails.push('no palette select in the header');
if (out.toolbars < 1) fails.push('no per-example toolbar');
if (out.toolbarHasDarkToggle) fails.push('the Dark toggle is still on the toolbar');
if (out.toolbarHasPalette) fails.push('the palette is still on the toolbar');
if (!out.toolbarHasMotion || !out.toolbarHasRadius) fails.push('the toolbar lost motion or radius');
if (!out.panelOpen) fails.push('the popover did not open');
if (!out.panelWithinViewport) fails.push('the popover runs off the viewport');
if (out.siteClientWidth < 280) fails.push(`site field is ${out.siteClientWidth}px wide`);
if (out.statusScrollWidth !== out.statusClientWidth) fails.push('the status line truncates');
if (overflowing.length) fails.push('something in the popover truncates: ' + overflowing.join(', '));
if (out.stageDark !== (out.rootTheme === 'dark')) fails.push('the stage does not follow the page theme');

out.verdict = fails.length ? 'FAIL ' + fails.join('; ') : 'PASS header controls, popover and toolbar';
return out;
