/**
 * What the site is called, what it is, where it lives, and the order of its pages.
 *
 * `astro.config.mjs` builds the Starlight sidebar from `NAV`, and the two agent files
 * under `src/pages` section their map by the same groups. A widget page added to a
 * category here is in the sidebar and in `/llms.txt` at once.
 */

export const SITE_NAME = 'SG Widgets';

export const SITE_DESCRIPTION =
  'Widgets for ShotGrid, now Flow Production Tracking, in React and Svelte, themed by your shadcn tokens.';

/** The canonical origin. The preview image and the agent files carry absolute URLs. */
export const SITE_URL = 'https://sg-widgets.vercel.app';

/** A docs page, named by its slug. The label overrides the page's own title. */
export type NavPage = { slug: string; label?: string };

/** A page of the site that is not in the docs collection, so it carries its own words. */
export type NavLink = { label: string; link: string; description: string };

/** Every docs page under a directory, in the order Starlight lists them. */
export type NavAuto = { directory: string };

export type NavGroup = { label: string; items: NavItem[] };

export type NavItem = NavPage | NavLink | NavAuto | NavGroup;

export const isPage = (item: NavItem): item is NavPage => 'slug' in item;
export const isLink = (item: NavItem): item is NavLink => 'link' in item;
export const isAuto = (item: NavItem): item is NavAuto => 'directory' in item;
export const isGroup = (item: NavItem): item is NavGroup => 'items' in item;

const widgets = (names: string[]): NavPage[] => names.map((name) => ({ slug: `widgets/${name}` }));

export const NAV: NavGroup[] = [
  {
    label: 'Start',
    items: [{ slug: 'start/introduction' }, { slug: 'start/install' }],
  },
  {
    label: 'Core',
    items: [{ directory: 'core' }],
  },
  {
    label: 'Widgets',
    items: [
      { label: 'Overview', slug: 'widgets' },
      {
        label: 'Foundations',
        items: [
          ...widgets([
            'thumbnail',
            'user-avatar',
            'text-editor',
            'number-editor',
            'checkbox-editor',
            'date-editor',
            'date-time-editor',
            'url-editor',
            'color-editor',
            'picker-control',
            'search-control',
            'collection-control',
            'value-editor',
            'state-line',
          ]),
          // A page of its own rather than a docs page, so the sidebar names the link.
          {
            label: 'Themes',
            link: '/themes/',
            description:
              'Paste a shadcn theme, see the widgets wearing it, and take it away with its status roles.',
          },
        ],
      },
      {
        label: 'Display',
        items: widgets(['status-badge', 'entity-chip', 'entity-card', 'field-value', 'match-text']),
      },
      {
        label: 'Pickers',
        items: widgets([
          'entity-picker',
          'entity-multi-picker',
          'user-picker',
          'user-multi-picker',
          'project-picker',
          'project-multi-picker',
          'status-picker',
          'status-multi-picker',
          'list-picker',
          'list-multi-picker',
          'entity-type-picker',
          'entity-type-multi-picker',
          'field-picker',
          'column-picker',
          'field-editor',
          'global-search',
          'hierarchical-search',
          'context-selector',
        ]),
      },
      {
        label: 'Queries and collections',
        items: widgets([
          'filter-editor',
          'filter-dialog',
          'filter-bar',
          'sort-picker',
          'entity-table',
          'entity-grid',
          'grouped-list',
          'entity-tree',
        ]),
      },
    ],
  },
];

/** What Starlight's `sidebar` takes. A link's description is the agent files' alone. */
export function starlightSidebar(): unknown[] {
  const item = (entry: NavItem): unknown => {
    if (isGroup(entry)) return { label: entry.label, items: entry.items.map(item) };
    if (isAuto(entry)) return { autogenerate: { directory: entry.directory } };
    if (isLink(entry)) return { label: entry.label, link: entry.link };
    return entry.label ? { label: entry.label, slug: entry.slug } : { slug: entry.slug };
  };
  return NAV.map(item);
}
