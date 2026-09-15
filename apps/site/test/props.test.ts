/**
 * Every props file says what its components take, in both frameworks.
 *
 * A file and its components have to agree in both directions: a prop a component
 * declares and no row names is undocumented, and a row naming a prop no component
 * declares is wrong. What the file resolves to -- its own rows, its base's, less what
 * it omits -- is the set compared.
 */
import { describe, expect, it } from 'vitest';
import { items, resolve } from '../src/props/_resolve';
import type { EventRow, PropRow, SlotRow } from '../src/props/_types';
import { reactProps, svelteDestructure, svelteProps } from './declared';

/** Spread onto the root rather than taken as a prop, or a framework's own. */
const IGNORED = new Set(['class', 'classname', 'ref', 'children', 'style', 'id']);

type Framework = 'react' | 'svelte';

const lower = (name: string): string => name.replace(/`/g, '').trim().toLowerCase();

/** Every name an item takes in one framework: its props, its events and its slots. */
function documented(item: string, framework: Framework): Set<string> {
  const names: string[] = [];
  for (const entry of resolve<PropRow>(item, 'props')) {
    if (entry.row.only && entry.row.only !== framework) continue;
    names.push(...entry.row.name.split('/'));
  }
  for (const entry of resolve<EventRow>(item, 'events')) {
    if (entry.row.only && entry.row.only !== framework) continue;
    names.push(entry.row.name);
  }
  for (const entry of resolve<SlotRow>(item, 'slots')) {
    names.push(framework === 'react' ? (entry.row.react ?? entry.row.name) : entry.row.name);
  }
  return new Set(names.map(lower).filter((name) => !IGNORED.has(name)));
}

function declared(names: string[]): Set<string> {
  return new Set(names.map(lower).filter((name) => !IGNORED.has(name)));
}

function report(item: string, framework: Framework, rows: Set<string>, source: Set<string>): void {
  const undocumented = [...source].filter((name) => !rows.has(name));
  const unknown = [...rows].filter((name) => !source.has(name));
  expect(
    { undocumented, unknown },
    `${item} (${framework}): apps/site/src/props/${item}.ts and the component disagree`,
  ).toEqual({ undocumented: [], unknown: [] });
}

describe('props files', () => {
  const named = Object.entries(items);

  it('every base an item extends has a file of its own', () => {
    for (const [item, file] of named) {
      if (!file.extends) continue;
      expect(Object.keys(items), `${item} extends ${file.extends.name}`).toContain(
        file.extends.name,
      );
    }
  });

  it('every page a file draws on holds a page of its own', () => {
    const pages = new Set(named.map(([item, file]) => file.page ?? item));
    for (const page of pages) expect(Object.keys(items)).toContain(page);
  });

  for (const [item, file] of named) {
    if (file.declares === false) continue;
    const declares = file.declares;

    it(`${item} names what React declares`, () => {
      const source = reactProps(item, declares?.react);
      expect(source, `no React props type for ${item}`).not.toBeNull();
      report(item, 'react', documented(item, 'react'), declared(source!));
    });

    it(`${item} names what Svelte declares`, () => {
      const source = svelteProps(item, declares?.svelte);
      expect(source, `no Svelte props type for ${item}`).not.toBeNull();
      report(item, 'svelte', documented(item, 'svelte'), declared(source!));
    });

    it(`${item} names every prop the Svelte component reads`, () => {
      const destructured = svelteDestructure(item);
      if (!destructured) return;
      const rows = documented(item, 'svelte');
      const missing = [...declared(destructured)].filter((name) => !rows.has(name));
      expect(missing, `${item}: read in $props() and named by no row`).toEqual([]);
    });
  }
});
