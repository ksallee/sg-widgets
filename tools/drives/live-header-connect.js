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
out.status = $('[data-live-status]').textContent.trim();
out.devNoteShown = getComputedStyle($('[data-live-dev-note]')).display !== 'none';
out.siteValue = $('[data-live-site]').value;
out.siteClientWidth = $('[data-live-site]').clientWidth;

// The project picker is a Svelte island mounted into the panel.
await wait(1500);
const project = $('[data-live-project]');
out.projectMounted = project.dataset.mounted === 'true';
out.projectShown = getComputedStyle($('[data-live-project-field]')).display !== 'none';
out.projectText = project.textContent.replace(/\s+/g, ' ').trim().slice(0, 80);

// The picker portals its own popover to `<body>`; the panel has to stay open through it.
project.querySelector('button')?.click();
await wait(600);
out.pickerOpen = Boolean($('[data-slot="popover-content"]'));
out.panelStillOpen = connect.hasAttribute('data-open');
document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await wait(300);

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
if (!out.status) fails.push('the status line is empty');
if (!out.projectShown || !out.projectMounted) fails.push('the project picker is not in the panel');
if (!out.pickerOpen) fails.push('the project picker did not open');
if (!out.panelStillOpen) fails.push('opening the picker closed the panel');
if (out.demoSource !== 'live') fails.push('the demo was not built against the live site');
if (/Loading the|Live mode needs|not ready/.test(out.svelteText + out.reactText)) {
  fails.push('a demo pane did not read the site');
}

out.verdict = fails.length ? 'FAIL ' + fails.join('; ') : 'PASS live from the header popover';
return out;
