// Open the header's Connect panel and report the rows the current state shows.
const trigger = $('[data-connect-trigger]');
if (!trigger) return { verdict: 'FAIL no Connect trigger in the header' };
trigger.click();
// The project picker is a Svelte island mounted into the panel.
await wait(1800);

const connect = $('[data-sg-connect]');
const shown = (selector) => {
  const el = $(selector);
  return el ? getComputedStyle(el).display !== 'none' : false;
};
const panel = $('#sg-connect-panel').getBoundingClientRect();

const out = {
  source: connect.dataset.source,
  liveState: connect.dataset.liveState,
  triggerLead: $('[data-connect-lead]').textContent,
  scope: $('[data-connect-scope]').textContent,
  status: $('[data-live-status]').textContent.trim(),
  siteFieldShown: shown('[data-live-site]'),
  siteFilled: $('[data-live-site]').value !== '',
  devNoteShown: shown('[data-live-dev-note]'),
  loginShown: shown('[data-live-login]'),
  logoutShown: shown('[data-live-logout]'),
  projectShown: shown('[data-live-project-field]'),
  panelWidth: Math.round(panel.width),
  panelHeight: Math.round(panel.height),
};

const fails = [];
if (!connect.hasAttribute('data-open')) fails.push('the panel did not open');
if (out.source === 'live' && !out.siteFilled) fails.push('live mode has no site');

out.verdict = fails.length ? 'FAIL ' + fails.join('; ') : `PASS the panel is open on ${out.source}`;
return out;
