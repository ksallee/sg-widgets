/**
 * Every props file says what its components take, in both frameworks.
 *
 * A file and its components have to agree in both directions: a prop a component
 * declares and no row names is undocumented, and a row naming a prop no component
 * declares is wrong. What the file resolves to -- its own rows, its base's, less what
 * it omits -- is the set compared.
 *
 * The type, default and payload columns are read the same way. A type is compared as
 * the table writes one: an alias expanded, an object down to its keys, a parameter list
 * down to how many it takes. A default written as code is the code the component falls
 * back to; a default written in words is the writer's to make good. A name is drawn
 * once: a prop is not also an event or a slot.
 */
import { describe, expect, it } from 'vitest';
import { items, resolve } from '../src/props/_resolve';
import type { EventRow, PropRow, SlotRow } from '../src/props/_types';
import type { Member, TypeIndex } from './declared';
import {
  constants,
  payloadOf,
  reactDefaults,
  reactIndex,
  reactProps,
  shapeOf,
  svelteDefaults,
  svelteDestructure,
  svelteIndex,
  svelteProps,
} from './declared';

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

const code = (text: string | undefined): string => (text ?? '').replace(/`/g, '').trim();

/** A default the file writes as code, rather than in words. */
const written = (text: string | undefined): boolean => /^`.*`$/.test((text ?? '').trim());

const unquoted = (text: string): string => text.replace(/^'|'$/g, '');

/** An optional prop is its own `undefined`; a table says what it takes when it is set. */
const set = (type: string): string => type.replace(/\s*\|\s*undefined\b/g, '');

/** Every name an item draws, a name drawn twice among them. */
function drawn(item: string, framework: Framework): string[] {
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
  return names.map(lower).filter((name) => !IGNORED.has(name));
}

interface Source {
  members: Map<string, Member>;
  /** What the component falls back to, or null when it destructures nothing. */
  defaults: Map<string, string | null> | null;
  index: TypeIndex;
}

function sourceOf(item: string, framework: Framework): Source | null {
  const file = items[item]!;
  const declares = file.declares === false ? undefined : file.declares;
  const members =
    framework === 'react' ? reactProps(item, declares?.react) : svelteProps(item, declares?.svelte);
  if (!members) return null;
  return {
    members: new Map(members.map((member) => [lower(member.name), member])),
    defaults: framework === 'react' ? reactDefaults(item, declares?.react) : svelteDefaults(item),
    index: framework === 'react' ? reactIndex : svelteIndex,
  };
}

/** Where a row and the prop it names disagree on the type, the default or the payload. */
function drifted(item: string, framework: Framework, source: Source): string[] {
  const out: string[] = [];
  const say = (name: string, column: string, says: string, is: string): void => {
    out.push(`${name} ${column}: the file says ${says}, the component ${is}`);
  };

  for (const entry of resolve<PropRow>(item, 'props')) {
    const row = entry.row;
    if (entry.owner !== item || (row.only && row.only !== framework)) continue;
    for (const spelling of row.name.split('/')) {
      const member = source.members.get(lower(spelling));
      if (!member || IGNORED.has(lower(spelling))) continue;
      const name = code(spelling);
      const wanted = code(row.type)
        .split('/')
        .map((one) => set(shapeOf(one, source.index)));
      const declared = set(shapeOf(member.type, source.index));
      if (!wanted.includes(declared)) say(name, 'type', wanted.join(' / '), declared);

      const shown = code(row.default);
      if ((shown === 'required') !== !member.optional)
        say(name, 'default', shown || 'nothing', member.optional ? 'optional' : 'required');
      if (!source.defaults?.has(member.name) || shown === 'required') continue;
      const fallback = source.defaults.get(member.name);
      const falls = fallback && constants.has(fallback) ? constants.get(fallback)! : fallback;
      if (!falls && /^(\[\]|\{\})$/.test(shown)) say(name, 'default', shown, 'gives none');
      else if (falls && (!shown || shown === '—')) say(name, 'default', 'none', falls);
      else if (falls && written(row.default) && unquoted(shown) !== unquoted(falls))
        say(name, 'default', shown, falls);
    }
  }

  for (const entry of resolve<EventRow>(item, 'events')) {
    const row = entry.row;
    if (entry.owner !== item || (row.only && row.only !== framework)) continue;
    const member = source.members.get(lower(row.name));
    if (!member) continue;
    const declared = payloadOf(member.type, source.index);
    if (!declared) continue;
    const wanted = code(row.payload)
      .split(',')
      .map((one) => shapeOf(one, source.index))
      .filter(Boolean);
    if (wanted.join(', ') !== declared.join(', '))
      say(code(row.name), 'payload', wanted.join(', ') || 'nothing', declared.join(', ') || 'nothing');
  }

  return out;
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
      report(item, 'react', documented(item, 'react'), declared(source!.map((m) => m.name)));
    });

    it(`${item} names what Svelte declares`, () => {
      const source = svelteProps(item, declares?.svelte);
      expect(source, `no Svelte props type for ${item}`).not.toBeNull();
      report(item, 'svelte', documented(item, 'svelte'), declared(source!.map((m) => m.name)));
    });

    it(`${item} names every prop the Svelte component reads`, () => {
      const destructured = svelteDestructure(item);
      if (!destructured) return;
      const rows = documented(item, 'svelte');
      const missing = [...declared(destructured)].filter((name) => !rows.has(name));
      expect(missing, `${item}: read in $props() and named by no row`).toEqual([]);
    });

    for (const framework of ['react', 'svelte'] as const) {
      it(`${item} types and defaults what ${framework} declares`, () => {
        const source = sourceOf(item, framework);
        expect(source, `no ${framework} props type for ${item}`).not.toBeNull();
        expect(
          drifted(item, framework, source!),
          `${item} (${framework}): apps/site/src/props/${item}.ts and the component disagree`,
        ).toEqual([]);
      });
    }

    it(`${item} draws every name once`, () => {
      for (const framework of ['react', 'svelte'] as const) {
        const names = drawn(item, framework);
        const twice = names.filter((name, index) => names.indexOf(name) !== index);
        expect([...new Set(twice)], `${item} (${framework}): drawn as two rows`).toEqual([]);
      }
    });
  }
});
