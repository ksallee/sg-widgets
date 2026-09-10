// Live mode, driven from the header popover.
const trigger = $('[data-connect-trigger]');
if (!trigger) return { verdict: 'FAIL no Connect trigger in the header' };

trigger.click();
await wait(400);

const connect = $('[data-sg-connect]');
const out = {};
out.source = connect.dataset.source;
out.liveState = connect.dataset.liveState;
out.livePressed = $('[data-source-pick="live"]').getAttribute('aria-pressed');
out.mockPressed = $('[data-source-pick="mock"]').getAttribute('aria-pressed');
out.triggerLabel = $('[data-connect-label]').textContent.replace(/\s+/g, ' ').trim();
out.triggerTitle = trigger.title;
out.host = $('[data-connect-host]').textContent;
out.scope = $('[data-connect-scope]').textContent;
out.rows = $$('#sg-connect-panel [data-connect-row]').map((el) => el.dataset.connectRow);
out.loginRowText = $('[data-connect-row="login"]').textContent.replace(/\s+/g, ' ').trim();

// The project picker is a Svelte island mounted into the panel.
await wait(1500);
const project = $('[data-live-project]');
out.projectShown = Boolean($('[data-live-project-field]'));
out.projectText = project.textContent.replace(/\s+/g, ' ').trim().slice(0, 80);

// The picker portals its own popover to `<body>`; the panel has to stay open through it.
// The picker opens on a press on its control, not on a click.
const control = $('[data-live-project] [data-slot="entity-picker-control"]');
control?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
await wait(900);
out.pickerOpen = Boolean($('[data-slot="entity-picker-content"]'));
out.panelStillOpen = Boolean($('#sg-connect-panel'));
document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await wait(300);
// Escape closes the topmost surface only: the picker goes, the panel stays.
out.pickerClosedFirst = !$('[data-slot="entity-picker-content"]') && Boolean($('#sg-connect-panel'));

// The demos themselves read the site.
out.demoSource = $('[data-sg-demo]').dataset.source;
out.svelteText = $('[data-island="svelte"]').textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
out.reactText = $('[data-island="react"]').textContent.replace(/\s+/g, ' ').trim().slice(0, 160);

const fails = [];
if (out.source !== 'live') fails.push('the panel is not in live mode');
if (out.livePressed !== 'true' || out.mockPressed !== 'false') fails.push('the Mock/Live control is wrong');
if (!out.triggerLabel.startsWith('Live')) fails.push(`the button says "${out.triggerLabel}"`);
if (!out.host) fails.push('the button does not name the site');
if (out.scope !== 'Whole site') fails.push(`the button scope says "${out.scope}"`);
if (out.rows.join(',') !== 'site,login,project') fails.push('the rows read ' + out.rows.join(','));
if (!out.loginRowText) fails.push('the login row says nothing');
if (!out.projectShown) fails.push('the project picker is not in the panel');
if (!out.pickerOpen) fails.push('the project picker did not open');
if (!out.panelStillOpen) fails.push('opening the picker closed the panel');
if (!out.pickerClosedFirst) fails.push('Escape did not close the picker before the panel');
if (out.demoSource !== 'live') fails.push('the demo was not built against the live site');
if (/Loading the|Live mode needs|not ready/.test(out.svelteText + out.reactText)) {
  fails.push('a demo pane did not read the site');
}

out.verdict = fails.length ? 'FAIL ' + fails.join('; ') : 'PASS live from the header popover';
return out;
