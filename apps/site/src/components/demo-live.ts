/**
 * What the demos read: the Connect control in Starlight's header.
 *
 * Source, site, login and project are site-wide and persisted, so every demo on
 * the page reads the same site. A demo is built once, when the island mounts, so
 * changing any of them reloads the page rather than trying to rebuild the
 * widgets underneath.
 */
import {
  demoSession,
  demoSiteUrl,
  demoSource,
  liveState,
  logIn,
  logOut,
  prepareDemoSource,
  setDemoProject,
  setDemoSiteUrl,
  setDemoSource,
  type DemoProject,
  type DemoSession,
} from '../demos/_shared/live';

function root(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-sg-connect]');
}

function say(message: string): void {
  const line = root()?.querySelector<HTMLElement>('[data-live-status]');
  if (line) line.textContent = message;
}

/** The session live mode is using, or the one waiting for it in this browser. */
function session(): DemoSession | null {
  return liveState().session ?? demoSession();
}

/** `anon` offers the login, `in` the logout, `dev` neither. */
function liveMode(): 'anon' | 'in' | 'dev' {
  if (liveState().devToken) return 'dev';
  return session() ? 'in' : 'anon';
}

/**
 * The site as the button names it: the studio, without the suffix every Flow PT
 * host carries. Anything else keeps its hostname.
 */
function shortHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname
      .replace(/^www\./, '')
      .replace(/\.(?:shotgrid\.autodesk\.com|shotgunstudio\.com)$/, '');
  } catch {
    return siteUrl;
  }
}

/** The button says what the demos read; only the host is allowed to run out of room. */
function paintTrigger(): void {
  const connect = root();
  const trigger = connect?.querySelector<HTMLElement>('[data-connect-trigger]');
  if (!connect || !trigger) return;

  const state = liveState();
  const live = demoSource() === 'live';
  const host = live ? shortHost(state.siteUrl) : '';
  const scope = state.project ? (state.project.name ?? `Project ${state.project.id}`) : 'Whole site';

  const part = (selector: string, value: string): void => {
    const node = trigger.querySelector<HTMLElement>(selector);
    if (!node) return;
    node.textContent = value;
    node.hidden = value === '';
  };

  part('[data-connect-lead]', live ? 'Live' : 'Connect');
  part('[data-connect-host]', host);
  part('[data-connect-scope]', live ? scope : '');
  const sepSite = trigger.querySelector<HTMLElement>('[data-connect-sep-site]');
  if (sepSite) sepSite.hidden = host === '';
  const sepScope = trigger.querySelector<HTMLElement>('[data-connect-sep-scope]');
  if (sepScope) sepScope.hidden = !live;

  trigger.title = live
    ? `Live · ${state.siteUrl || 'no site'} · ${scope}`
    : 'The demos read fixtures. Open to point them at a site.';
}

function paint(): void {
  const state = liveState();
  const source = demoSource();
  const mode = liveMode();

  // Each demo states the source its islands were built against.
  for (const figure of document.querySelectorAll<HTMLElement>('[data-sg-demo]')) {
    figure.dataset.source = source;
  }

  const connect = root();
  if (connect) {
    connect.dataset.source = source;
    connect.dataset.liveState = mode;
    // The picker needs a client, so it shows only once live mode can read the site.
    connect.toggleAttribute('data-live-ready', source === 'live' && state.problem === null);
    for (const pick of connect.querySelectorAll<HTMLButtonElement>('[data-source-pick]')) {
      pick.setAttribute('aria-pressed', String(pick.dataset.sourcePick === source));
    }
    const site = connect.querySelector<HTMLInputElement>('[data-live-site]');
    if (site && document.activeElement !== site) site.value = state.siteUrl || demoSiteUrl();
  }

  paintTrigger();

  if (source !== 'live') {
    const known = session();
    say(known ? `The demos read fixtures. Logged in as ${known.login} for live mode.` : 'The demos read fixtures.');
    return;
  }
  if (state.problem) say(state.problem);
  else if (mode === 'dev') say(`Reading ${state.siteUrl} with the dev token.`);
  else if (state.session) say(`Logged in as ${state.session.login} on ${state.siteUrl}.`);
  else say('Log in to read the site.');
}

/** The site's own project picker, bound to `sg-demo:project`. */
async function mountProjectPicker(): Promise<void> {
  const state = liveState();
  const host = root()?.querySelector<HTMLElement>('[data-live-project]');
  if (!host || host.dataset.mounted || state.source !== 'live' || state.problem) return;

  // Svelte, because the picker exists in both frameworks and one island is enough here.
  const [{ mount }, { liveClient }, picker] = await Promise.all([
    import('svelte'),
    import('../demos/_shared/live'),
    import('$lib/registry/components/project-picker.svelte'),
  ]);
  host.dataset.mounted = 'true';
  host.replaceChildren();
  mount(picker.default, {
    target: host,
    props: {
      client: liveClient(),
      size: 'sm',
      placeholder: 'Whole site',
      clearable: true,
      value: state.project ? { type: 'Project', id: state.project.id, name: state.project.name } : null,
      onValueChange: (value: { id: number; name?: string } | null) => {
        const project: DemoProject | null = value ? { id: value.id, name: value.name } : null;
        setDemoProject(project);
        location.reload();
      },
    },
  });
}

async function runLogin(button: HTMLButtonElement): Promise<void> {
  const siteUrl = root()?.querySelector<HTMLInputElement>('[data-live-site]')?.value.trim() ?? '';
  if (!siteUrl) {
    say('Give the site url first.');
    return;
  }
  setDemoSiteUrl(siteUrl);
  button.disabled = true;
  say('Approve the request in the tab that just opened.');
  try {
    // The launcher hands the token out once, so one poll runs and it runs here.
    await logIn(siteUrl, (url) => window.open(url, '_blank', 'noopener'));
    location.reload();
  } catch (error) {
    say(error instanceof Error ? error.message : String(error));
  } finally {
    button.disabled = false;
  }
}

export async function mountLiveControls(): Promise<void> {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('[data-sg-connect]')) return;

    const pick = target.closest<HTMLElement>('[data-source-pick]');
    if (pick?.dataset.sourcePick) {
      if (pick.dataset.sourcePick === demoSource()) return;
      setDemoSource(pick.dataset.sourcePick === 'live' ? 'live' : 'mock');
      location.reload();
      return;
    }
    const login = target.closest<HTMLButtonElement>('[data-live-login]');
    if (login) {
      void runLogin(login);
      return;
    }
    if (target.closest('[data-live-logout]')) {
      logOut();
      location.reload();
    }
  });

  document.addEventListener('change', (event) => {
    const site = (event.target as HTMLElement | null)?.closest<HTMLInputElement>('[data-live-site]');
    if (!site) return;
    const value = site.value.trim();
    if (value === liveState().siteUrl) return;
    setDemoSiteUrl(value);
    if (demoSource() === 'live') location.reload();
  });

  paint();
  await prepareDemoSource();
  paint();
  await mountProjectPicker();
}
