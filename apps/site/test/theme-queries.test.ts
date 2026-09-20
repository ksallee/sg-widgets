/**
 * The theme-bearing classes the queries and collections widgets carry.
 *
 * tweakcn's preview is the reference, and it is plain shadcn: a bordered trigger takes
 * `shadow-xs`, a card takes a border and a radius and no shadow, and a table, a tree and
 * a grouped list take neither. A part of ours that is not the primitive carries what the
 * primitive carries, in the same place and in both frameworks.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const react = join(root, 'packages/react/src/registry/sg/components');
const svelte = join(root, 'packages/svelte/src/lib/registry/components');
const demos = join(root, 'apps/site/src/demos');

/** Every quoted class string in a source file, read the way `theme-classes.test.ts` reads one. */
function classStrings(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return [...code.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)]
    .map((match) => match[1] ?? match[2])
    .filter((value) => value.includes(' ') || value.includes(':'));
}

/** The class strings of a file that hold `anchor`; every one of them is the part named. */
function parts(path: string, anchor: string): string[] {
  const found = classStrings(readFileSync(path, 'utf8')).filter((value) => value.includes(anchor));
  expect(found, `${path} has no class string holding ${anchor}`).not.toHaveLength(0);
  return found;
}

interface Part {
  /** What the row is about, in the failure message. */
  name: string;
  /** The file under each package, React first, with its own extension. */
  files: [string, string];
  /** A class only that part carries, which locates its class string. */
  anchor: string;
  /** Classes that part has to carry. */
  wears: string[];
  /** Classes that part must not carry. */
  bare?: string[];
}

/**
 * A bordered trigger of ours is the outline button: the border, the radius and the
 * shadow it carries, in the same place.
 */
const TRIGGERS: Part[] = [
  {
    name: "the filter bar's facet pill",
    files: [join(react, 'filter-bar.tsx'), join(svelte, 'filter-bar.svelte')],
    anchor: 'max-w-full min-w-0 items-center overflow-hidden rounded-lg border',
    wears: ['border-border', 'rounded-lg', 'border', 'shadow-xs'],
  },
  {
    name: "the filter dialog's launcher",
    files: [join(react, 'filter-dialog.tsx'), join(svelte, 'filter-dialog.svelte')],
    anchor: 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border',
    wears: ['border-border', 'bg-background', 'rounded-lg', 'border', 'shadow-xs'],
  },
  {
    name: "the sort picker's trigger",
    files: [join(react, 'sort-picker.tsx'), join(svelte, 'sort-picker.svelte')],
    anchor: 'inline-flex min-w-0 items-center gap-1.5 rounded-lg border',
    wears: ['border-border', 'bg-background', 'rounded-lg', 'border', 'shadow-xs'],
  },
  {
    name: "the collection demos' toolbar button",
    files: [join(demos, 'entity-table/Demo.tsx'), join(demos, 'entity-table/Demo.svelte')],
    anchor: 'rounded-lg border border-border bg-background',
    wears: ['rounded-lg', 'border', 'border-border', 'bg-background', 'shadow-xs'],
  },
];

/**
 * A collection's body is an inline region in the page flow: a border and a radius, and
 * no shadow, which is what tweakcn's own table and card show.
 */
const REGIONS: Part[] = [
  {
    name: "the table's body",
    files: [join(react, 'entity-table.tsx'), join(svelte, 'entity-table.svelte')],
    anchor: 'relative w-full overflow-auto rounded-lg border',
    wears: ['border-border', 'rounded-lg', 'border'],
    bare: ['shadow-xs', 'shadow-sm', 'shadow-md'],
  },
  {
    name: "the grid's body",
    files: [join(react, 'entity-grid.tsx'), join(svelte, 'entity-grid.svelte')],
    anchor: 'flex w-full flex-col gap-3 overflow-auto rounded-lg border',
    wears: ['border-border', 'rounded-lg', 'border'],
    bare: ['shadow-xs', 'shadow-sm', 'shadow-md'],
  },
  {
    name: "the grid's tile skeleton",
    files: [join(react, 'entity-grid.tsx'), join(svelte, 'entity-grid.svelte')],
    anchor: 'flex min-w-0 flex-col overflow-hidden rounded-lg border',
    wears: ['border-border', 'bg-card', 'rounded-lg', 'border'],
    bare: ['shadow-xs', 'shadow-sm', 'shadow-md'],
  },
  {
    name: "the grouped list's body",
    files: [join(react, 'grouped-list.tsx'), join(svelte, 'grouped-list.svelte')],
    anchor: 'w-full overflow-auto rounded-lg border',
    wears: ['border-border', 'rounded-lg', 'border'],
    bare: ['shadow-xs', 'shadow-sm', 'shadow-md'],
  },
  {
    name: "the tree's body",
    files: [join(react, 'entity-tree.tsx'), join(svelte, 'entity-tree.svelte')],
    anchor: 'w-full overflow-auto rounded-lg border p-1',
    wears: ['border-border', 'rounded-lg', 'border'],
    bare: ['shadow-xs', 'shadow-sm', 'shadow-md'],
  },
];

/** A group header is a tinted band, so it wears the whole of the theme's muted. */
const GROUP_HEADERS: Part[] = [
  {
    name: "the table's group row",
    files: [join(react, 'entity-table.tsx'), join(svelte, 'entity-table.svelte')],
    anchor: 'hover:bg-muted',
    wears: ['bg-muted', 'hover:bg-muted'],
    bare: ['bg-muted/50', 'hover:bg-muted/50'],
  },
  {
    name: "the grouped list's group header",
    files: [join(react, 'grouped-list.tsx'), join(svelte, 'grouped-list.svelte')],
    anchor: 'sticky top-0 z-10 flex w-full items-center',
    wears: ['bg-muted', 'border-border', 'border-b'],
    bare: ['bg-muted/50'],
  },
];

describe('the queries and collections widgets wear the theme where shadcn does', () => {
  for (const part of [...TRIGGERS, ...REGIONS, ...GROUP_HEADERS]) {
    it(`${part.name} carries ${part.wears.join(' ')}, in both frameworks`, () => {
      for (const path of part.files) {
        for (const value of parts(path, part.anchor)) {
          const classes = value.split(/\s+/);
          for (const wanted of part.wears) {
            expect(classes, `${path}: ${part.name}`).toContain(wanted);
          }
          for (const unwanted of part.bare ?? []) {
            expect(classes, `${path}: ${part.name}`).not.toContain(unwanted);
          }
        }
      }
    });
  }
});

describe('both frameworks draw one widget', () => {
  for (const name of [
    'filter-bar',
    'filter-dialog',
    'filter-editor',
    'sort-picker',
    'entity-table',
    'entity-grid',
    'grouped-list',
    'entity-tree',
  ]) {
    it(`${name} carries the same shadow classes in React and Svelte`, () => {
      const shadows = (path: string) =>
        [...readFileSync(path, 'utf8').matchAll(/(?:^|[\s'"`])(shadow-(?:xs|sm|md|lg|xl|none))(?=[\s'"`])/g)]
          .map((match) => match[1] as string)
          .sort();
      expect(shadows(join(react, `${name}.tsx`)), name).toEqual(shadows(join(svelte, `${name}.svelte`)));
    });
  }
});
