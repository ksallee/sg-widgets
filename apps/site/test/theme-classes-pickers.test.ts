/**
 * The classes a theme is worn on in the pickers.
 *
 * `apps/site/test/theme-classes.test.ts` reads the primitives; this one reads the
 * widget chrome above them. A picker draws its own bordered field rather than the
 * `Input` primitive, so the field has to carry what the primitive carries: the
 * shadow, the border token and the radius. Every picker takes its field from
 * `picker-classes.ts`, and the three that draw one of their own are read beside it.
 *
 * The placements are tweakcn's preview, which is plain `new-york-v4`: `shadow-xs` on
 * an input and on a select trigger, nothing on a badge or a ghost button, `shadow-md`
 * on a popover, and a command's input row is a bare bottom border with no shadow.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const react = join(root, 'packages/react/src/registry/sg/components');
const svelte = join(root, 'packages/svelte/src/lib/registry/components');

/**
 * Every quoted class string in a source file. A class string holds quotes of the other
 * kind, so the two kinds are read apart, and comments go first so an apostrophe in one
 * opens nothing.
 */
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
  /** The file under each package's registry directory, React first. */
  files: [string, string];
  /** A class only that part carries, which locates its class string. */
  anchor: string;
  /** The theme-bearing classes that part has to carry. */
  wears: string[];
  /** Classes that part must not carry, where a wrong token would read as a theme. */
  wearsNot?: string[];
}

/**
 * A bordered field a picker draws for itself. Its twin is the input and the select
 * trigger, so it takes the shadow, the border token and the radius they take.
 */
const FIELDS: Part[] = [
  {
    name: "every picker's control",
    files: ['picker-classes.ts', 'picker-classes.ts'],
    anchor: 'has-[:focus-visible]:ring-ring',
    wears: ['shadow-xs', 'border-input', 'rounded-lg'],
  },
  {
    name: "the context selector's trigger",
    files: ['context-selector.tsx', 'context-selector.svelte'],
    anchor: 'rounded-lg border text-left',
    wears: ['shadow-xs', 'border-input', 'rounded-lg'],
    // `--border` and `--input` part on a palette that tints them, Bubblegum for one,
    // and a control reads the input's.
    wearsNot: ['border-border'],
  },
  {
    name: "the global search's inline shell",
    files: ['global-search.tsx', 'global-search.svelte'],
    anchor: 'rounded-lg border',
    wears: ['shadow-xs', 'border-input', 'rounded-lg'],
    wearsNot: ['border-border'],
  },
  {
    name: "the hierarchical search's inline shell",
    files: ['hierarchical-search.tsx', 'hierarchical-search.svelte'],
    anchor: 'rounded-lg border',
    wears: ['shadow-xs', 'border-input', 'rounded-lg'],
    wearsNot: ['border-border'],
  },
];

describe('the bordered field a picker draws for itself', () => {
  for (const part of FIELDS) {
    const [reactFile, svelteFile] = part.files;
    it(`${part.name} carries ${part.wears.join(' ')}, in both frameworks`, () => {
      for (const path of [join(react, reactFile), join(svelte, svelteFile)]) {
        for (const value of parts(path, part.anchor)) {
          const classes = value.split(/\s+/);
          for (const wears of part.wears) expect(classes, `${path}: ${part.name}`).toContain(wears);
          for (const not of part.wearsNot ?? []) expect(classes, `${path}: ${part.name}`).not.toContain(not);
        }
      }
    });
  }
});

/**
 * The parts of a picker whose twin carries no shadow. A wrong one here is as visible
 * as a missing one: a badge that lifts and a command row that lifts are both wrong.
 */
const FLAT: Part[] = [
  {
    name: "the popup's search row",
    files: ['picker-classes.ts', 'picker-classes.ts'],
    anchor: 'border-b px-3',
    wears: [],
  },
  {
    name: 'a chosen code, which is a badge',
    files: ['picker-classes.ts', 'picker-classes.ts'],
    anchor: 'bg-secondary text-secondary-foreground',
    wears: [],
  },
  {
    name: 'the clear control and the chevron, which are ghost buttons',
    files: ['picker-classes.ts', 'picker-classes.ts'],
    anchor: 'pointer-coarse:before:size-11',
    wears: [],
  },
  {
    name: 'one row',
    files: ['picker-classes.ts', 'picker-classes.ts'],
    anchor: 'data-highlighted:bg-accent',
    wears: [],
  },
];

describe('the parts of a picker whose twin carries no shadow', () => {
  for (const part of FLAT) {
    const [reactFile, svelteFile] = part.files;
    it(`${part.name} carries none`, () => {
      for (const path of [join(react, reactFile), join(svelte, svelteFile)]) {
        for (const value of parts(path, part.anchor)) {
          expect(value.split(/\s+/).filter((one) => one.startsWith('shadow-')), `${path}: ${part.name}`).toHaveLength(0);
        }
      }
    });
  }
});

describe('the popup a picker hangs off its control', () => {
  it('carries the popover shadow, in both frameworks', () => {
    for (const path of [join(react, 'picker-classes.ts'), join(svelte, 'picker-classes.ts')]) {
      const found = parts(path, 'bg-popover text-popover-foreground');
      expect(found, `${path}: both popups`).toHaveLength(2);
      for (const value of found) expect(value.split(/\s+/), `${path}: the popup`).toContain('shadow-md');
    }
  });
});
