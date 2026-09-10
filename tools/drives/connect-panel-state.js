// The Connect panel shows one choice, then the rows that choice needs.
//
// Mock: the choice and nothing under it. Live with the dev key: site, login state and
// project, in that order. Escape closes the panel and hands focus back to the trigger.
const trigger = $('[data-connect-trigger]');
if (!trigger) return { verdict: 'FAIL no Connect trigger in the header' };

// Focused first, the way a keyboard reaches it, so the focus return has somewhere to go.
trigger.focus({ preventScroll: true });
trigger.click();
// The project picker is a Svelte island mounted into the panel.
await wait(1800);

const connect = $('[data-sg-connect]');
const panel = $('#sg-connect-panel');
if (!panel) return { verdict: 'FAIL the panel did not open' };
const box = panel.getBoundingClientRect();

const out = {
  source: connect.dataset.source,
  mode: connect.dataset.liveState,
  triggerLabel: $('[data-connect-label]').textContent.replace(/\s+/g, ' ').trim(),
  triggerTitle: trigger.title,
  rows: $$('#sg-connect-panel [data-connect-row]').map((el) => el.dataset.connectRow),
  pressed: $$('[data-source-pick]')
    .map((b) => `${b.dataset.sourcePick}=${b.getAttribute('aria-pressed')}`)
    .join(' '),
  siteInput: Boolean($('[data-live-site]')),
  siteRowText: $('[data-connect-row="site"]')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
  loginRowText: $('[data-connect-row="login"]')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
  signIn: Boolean($('[data-live-login]')),
  signOut: Boolean($('[data-live-logout]')),
  devKey: Boolean($('[data-live-dev]')),
  project: Boolean($('[data-live-project-field]')),
  panelWidth: Math.round(box.width),
  panelHeight: Math.round(box.height),
  withinViewport: box.right <= window.innerWidth + 1 && box.left >= -1,
  // Nothing in the panel truncates: every element renders at its full width.
  overflowing: $$('#sg-connect-panel *')
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => `${el.tagName}.${el.className}`),
};

const fails = [];
if (!connect.hasAttribute('data-open')) fails.push('the panel is not marked open');
if (!out.withinViewport) fails.push('the panel runs off the viewport');
if (out.overflowing.length) fails.push('something truncates: ' + out.overflowing.join(', '));

if (out.source === 'mock') {
  if (out.triggerLabel !== 'Mock') fails.push(`the trigger says "${out.triggerLabel}"`);
  if (out.pressed !== 'mock=true live=false') fails.push(`the choice reads ${out.pressed}`);
  if (out.rows.length) fails.push('Mock shows rows under the choice: ' + out.rows.join(', '));
  if (out.siteInput) fails.push('Mock still shows the site field');
  if (out.signIn || out.signOut) fails.push('Mock still shows the login controls');
  if (out.devKey) fails.push('Mock still shows the dev key line');
  if (out.project) fails.push('Mock still shows the project picker');
} else {
  if (!out.triggerLabel.startsWith('Live')) fails.push(`the trigger says "${out.triggerLabel}"`);
  if (out.pressed !== 'mock=false live=true') fails.push(`the choice reads ${out.pressed}`);
  if (out.rows.join(',') !== 'site,login,project') fails.push('the rows read ' + out.rows.join(','));
  if (!out.devKey) fails.push('the dev key state does not say so');
  if (out.signIn || out.signOut) fails.push('the dev key state offers a login control');
  if (out.siteInput) fails.push('the settled site row is still an input');
  if (!out.project) fails.push('no project picker');
}

// Focus, dismissal and the focus return come from the popover primitive.
out.focusInPanel = panel.contains(document.activeElement);
panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await wait(400);
out.closedOnEscape = !$('#sg-connect-panel');
out.focusOnTrigger = document.activeElement === trigger;
if (!out.focusInPanel) fails.push('opening the panel left focus outside it');
if (!out.closedOnEscape) fails.push('Escape did not close the panel');
if (!out.focusOnTrigger) fails.push('focus did not return to the trigger');

// Left open, so a screenshot taken after this drive shows the panel.
trigger.click();
await wait(400);

out.verdict = fails.length ? 'FAIL ' + fails.join('; ') : `PASS the panel on ${out.source}: ${out.rows.join(', ') || 'the choice alone'}`;
return out;
