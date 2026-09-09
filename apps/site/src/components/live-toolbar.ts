/**
 * The Mock/Live half of the demo toolbar.
 *
 * Source, site, login and project are page-wide and persisted, so every demo on
 * the page reads the same site. A demo is built once, when the island mounts, so
 * changing any of them reloads the page rather than trying to rebuild the
 * widgets underneath.
 */
import {
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
} from '../demos/_shared/live';

function figures(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-sg-demo]')];
}

function say(message: string): void {
  for (const figure of figures()) {
    const line = figure.querySelector<HTMLElement>('[data-live-status]');
    if (line) line.textContent = message;
  }
}

/** `anon` offers the login, `in` the logout, `dev` neither. */
function liveMode(): 'anon' | 'in' | 'dev' {
  const state = liveState();
  if (state.devToken) return 'dev';
  return state.session ? 'in' : 'anon';
}

function paint(): void {
  const state = liveState();
  const source = demoSource();
  const mode = liveMode();
  for (const figure of figures()) {
    figure.dataset.source = source;
    for (const pick of figure.querySelectorAll<HTMLButtonElement>('[data-source-pick]')) {
      pick.setAttribute('aria-pressed', String(pick.dataset.sourcePick === source));
    }
    const bar = figure.querySelector<HTMLElement>('[data-live-bar]');
    if (bar) bar.dataset.liveState = mode;
    const site = figure.querySelector<HTMLInputElement>('[data-live-site]');
    if (site && document.activeElement !== site) site.value = state.siteUrl || demoSiteUrl();
  }
  if (source !== 'live') return;
  if (state.problem) say(state.problem);
  else if (mode === 'dev') say('Reading the site with the dev token from .env.local. No login needed.');
  else if (state.session) say(`Logged in as ${state.session.login}.`);
  else say('Log in to read the site.');
}

/** The site's own project picker, bound to `sg-demo:project`. */
async function mountProjectPickers(): Promise<void> {
  const state = liveState();
  const hosts = figures()
    .map((figure) => figure.querySelector<HTMLElement>('[data-live-project]'))
    .filter((host): host is HTMLElement => host !== null && !host.dataset.mounted);
  if (hosts.length === 0 || state.source !== 'live' || state.problem) return;

  // Svelte, because the picker exists in both frameworks and one island is enough here.
  const [{ mount }, { liveClient }, picker] = await Promise.all([
    import('svelte'),
    import('../demos/_shared/live'),
    import('$lib/registry/components/project-picker.svelte'),
  ]);
  for (const host of hosts) {
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
}

async function runLogin(button: HTMLButtonElement): Promise<void> {
  const bar = button.closest<HTMLElement>('[data-live-bar]');
  const siteUrl = bar?.querySelector<HTMLInputElement>('[data-live-site]')?.value.trim() ?? '';
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

export async function mountLiveToolbar(): Promise<void> {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('[data-sg-demo]')) return;

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
  await mountProjectPickers();
}
