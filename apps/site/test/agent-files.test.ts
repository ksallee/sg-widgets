/**
 * What `/llms.txt` and `/llms-full.txt` serve.
 *
 * Both are built from the docs collection and the sidebar in `src/site-nav.ts`, so the
 * pages on the site and the pages in the map are the same set, and the widget lines are
 * read back out of the file to prove it.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GET as llms } from '../src/pages/llms.txt';
import { GET as llmsFull } from '../src/pages/llms-full.txt';
import { strip } from '../src/pages/_llms';
import { NAV, SITE_URL } from '../src/site-nav';

/** The endpoints read `site` and nothing else of the context. */
const context = () => ({ site: new URL(SITE_URL) }) as never;

async function body(route: typeof llms): Promise<string> {
  const answer = await route(context());
  expect(answer).toBeInstanceOf(Response);
  const response = answer as Response;
  expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  return response.text();
}

const widgetPages = readdirSync(
  fileURLToPath(new URL('../src/content/docs/widgets/', import.meta.url)),
)
  .filter((name) => name.endsWith('.mdx') && name !== 'index.mdx')
  .map((name) => name.replace(/\.mdx$/, ''));

const categories = NAV.flatMap((group) =>
  group.items.filter((item) => 'items' in item).map((item) => (item as { label: string }).label),
);

describe('the map at /llms.txt', () => {
  it('opens on the site name and one blockquote of what it is', async () => {
    const text = await body(llms);
    const [title, blank, summary] = text.split('\n');
    expect(title).toBe('# SG Widgets');
    expect(blank).toBe('');
    expect(summary).toMatch(/^> .*ShotGrid.*Flow Production Tracking.*React.*Svelte.*shadcn/);
  });

  it('carries one section per sidebar category', async () => {
    const text = await body(llms);
    const headings = text.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual(
      ['Start', 'Core', 'Widgets', ...categories].map((label) => `## ${label}`),
    );
  });

  it('lists every widget page with its title, its absolute url and its description', async () => {
    const text = await body(llms);
    for (const page of widgetPages) {
      const found = text
        .split('\n')
        .find((l) => l.includes(`(${SITE_URL}/widgets/${page}/)`));
      expect(found, page).toMatch(
        new RegExp(`^- \\[.+\\]\\(${SITE_URL}/widgets/${page}/\\): .+$`),
      );
    }
  });

  it('writes every link absolute, and points at the full file', async () => {
    const text = await body(llms);
    for (const link of text.match(/\]\([^)]+\)/g) ?? []) {
      expect(link).toContain(`](${SITE_URL}/`);
    }
    expect(text).toContain(`${SITE_URL}/llms-full.txt`);
  });

  it('names the pages that are not docs pages', async () => {
    const text = await body(llms);
    expect(text).toContain(`- [Themes](${SITE_URL}/themes/): `);
  });
});

describe('the prose at /llms-full.txt', () => {
  it('opens on the same map', async () => {
    const map = await body(llms);
    const full = await body(llmsFull);
    expect(full.startsWith(map)).toBe(true);
  });

  it('gives every widget page a heading and the url it came from', async () => {
    const full = await body(llmsFull);
    for (const page of widgetPages) {
      expect(full, page).toContain(`Source: ${SITE_URL}/widgets/${page}/`);
    }
  });

  it('keeps the prose, the tables and the code blocks of a page', async () => {
    const full = await body(llmsFull);
    expect(full).toContain('Renders rows from an entity source as a table');
    expect(full).toContain('```ts');
    expect(full).toContain('<EntityTable');
    expect(full).toMatch(/^\| .+ \|$/m);
  });

  it('leaves no import and no component behind', async () => {
    const full = await body(llmsFull);
    const outside = full.split(/```[\s\S]*?\n```/g).join('\n');
    expect(outside).not.toContain('import Demo');
    expect(outside).not.toContain('<Demo');
    expect(outside).not.toContain('<Props');
    expect(outside).not.toContain('<Install');
    expect(outside).not.toContain('<CardGrid');
  });
});

describe('an mdx body as text', () => {
  it('drops an import, a self-closing component and one written over lines', () => {
    const text = strip(
      ["import Demo from '../x.astro';", '', 'Prose.', '', '<Demo name="a" />', '', '<Props', '  name="a"', '/>', '', 'More.'].join('\n'),
    );
    expect(text).toBe('Prose.\n\nMore.');
  });

  it('touches nothing inside a fence', () => {
    const source = ['```svelte', '<EntityTable', '  {context}', '/>', '```'].join('\n');
    expect(strip(source)).toBe(source);
  });
});
