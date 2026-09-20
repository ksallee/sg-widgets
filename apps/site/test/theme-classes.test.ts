/**
 * The classes a theme is worn on, and the variables the site bridges to them.
 *
 * A pasted theme names a shadow, a radius, a letter spacing and three families. A
 * shadow and a radius only show where a component carries the utility, so each
 * primitive part below is read for the class its shadcn twin carries there, in both
 * frameworks at once. The rest reach a widget through the site's Tailwind block, which
 * has to bridge every variable tweakcn's export writes.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const reactUi = join(root, 'packages/react/src/components/ui');
const svelteUi = join(root, 'packages/svelte/src/lib/components/ui');

/**
 * Every quoted class string in a source file. A class string holds quotes of the other
 * kind, as `[&_svg:not([class*='size-'])]` does, so the two kinds are read apart, and
 * comments go first so an apostrophe in one opens nothing.
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
  /** The file name under each package's `ui` directory, React first. */
  files: [string, string];
  /** A class only that part carries, which locates its class string. */
  anchor: string;
  /** The theme-bearing class that part has to carry. */
  wears: string;
}

/**
 * The parts a shadow lands on, and the class each takes. The placements are shadcn's
 * own: a shadow on the bordered controls and on the dialog, none on a filled button,
 * a badge or a table.
 */
const SHADOWS: Part[] = [
  {
    name: 'the outline button',
    files: ['button.tsx', 'button/button.svelte'],
    anchor: 'dark:border-input',
    wears: 'shadow-xs',
  },
  {
    name: 'the input',
    files: ['input.tsx', 'input/input.svelte'],
    anchor: 'border border-input',
    wears: 'shadow-xs',
  },
  {
    name: 'the textarea',
    files: ['textarea.tsx', 'textarea/textarea.svelte'],
    anchor: 'field-sizing-content',
    wears: 'shadow-xs',
  },
  {
    name: 'the select trigger',
    files: ['select.tsx', 'select/select-trigger.svelte'],
    anchor: 'data-[size=sm]:rounded-[min(var(--radius-md),10px)]',
    wears: 'shadow-xs',
  },
  {
    name: 'the checkbox',
    files: ['checkbox.tsx', 'checkbox/checkbox.svelte'],
    anchor: 'data-checked:bg-primary',
    wears: 'shadow-xs',
  },
  {
    name: 'the switch',
    files: ['switch.tsx', 'switch/switch.svelte'],
    anchor: 'data-unchecked:bg-input',
    wears: 'shadow-xs',
  },
  {
    name: 'the outline toggle',
    files: ['toggle.tsx', 'toggle/toggle.svelte'],
    anchor: 'border border-input bg-transparent',
    wears: 'shadow-xs',
  },
  {
    name: 'the input group',
    files: ['input-group.tsx', 'input-group/input-group.svelte'],
    anchor: 'group/input-group',
    wears: 'shadow-xs',
  },
  {
    name: 'the dialog',
    files: ['dialog.tsx', 'dialog/dialog-content.svelte'],
    anchor: 'ring-1 ring-foreground/10',
    wears: 'shadow-lg',
  },
];

/** The floating surfaces, which carried a shadow already and keep it. */
const FLOATING: Part[] = [
  {
    name: 'the popover',
    files: ['popover.tsx', 'popover/popover-content.svelte'],
    anchor: 'ring-1 ring-foreground/10',
    wears: 'shadow-md',
  },
  {
    name: 'the select popup',
    files: ['select.tsx', 'select/select-content.svelte'],
    anchor: 'min-w-36',
    wears: 'shadow-md',
  },
  {
    name: 'the hover card',
    files: ['hover-card.tsx', 'hover-card/hover-card-content.svelte'],
    anchor: 'ring-1 ring-foreground/10',
    wears: 'shadow-md',
  },
  {
    name: 'the dropdown menu',
    files: ['dropdown-menu.tsx', 'dropdown-menu/dropdown-menu-content.svelte'],
    anchor: 'min-w-32',
    wears: 'shadow-md',
  },
  {
    name: 'the dropdown submenu',
    files: ['dropdown-menu.tsx', 'dropdown-menu/dropdown-menu-sub-content.svelte'],
    anchor: 'min-w-[96px]',
    wears: 'shadow-lg',
  },
];

describe('the parts a theme wears its shadow on', () => {
  for (const part of [...SHADOWS, ...FLOATING]) {
    const [react, svelte] = part.files;
    it(`${part.name} carries ${part.wears}, in both frameworks`, () => {
      for (const path of [join(reactUi, react), join(svelteUi, svelte)]) {
        for (const value of parts(path, part.anchor)) {
          expect(value.split(/\s+/), `${path}: ${part.name}`).toContain(part.wears);
        }
      }
    });
  }
});

const globalCss = readFileSync(join(root, 'apps/site/src/styles/global.css'), 'utf8');

/** A block of global.css, from its opening line to the first line that closes it. */
function block(opening: string): string {
  const start = globalCss.indexOf(opening);
  expect(start, `global.css has no ${opening} block`).toBeGreaterThan(-1);
  return globalCss.slice(start, globalCss.indexOf('\n}', start));
}

/** The eight shadow steps a tweakcn export writes, from https://tweakcn.com/r/themes/bubblegum.json. */
const SHADOW_STEPS = ['2xs', 'xs', 'sm', '', 'md', 'lg', 'xl', '2xl'];

/** The five spacing steps that export derives from `--tracking-normal`. */
const TRACKING_STEPS = ['tighter', 'tight', 'wide', 'wider', 'widest'];

describe("the site's Tailwind block", () => {
  it('reads every shadow step off the token of that name', () => {
    const inline = block('@theme inline {');
    for (const step of SHADOW_STEPS) {
      const name = step === '' ? '--shadow' : `--shadow-${step}`;
      const declaration = new RegExp(`^\\s*${name}:\\s*(.+);$`, 'm').exec(inline);
      expect(declaration, `global.css does not map ${name}`).not.toBeNull();
      expect(declaration?.[1], `${name} reads no token of its own`).toContain(`var(${name},`);
    }
  });

  it('gives the radius steps to the radius a theme names', () => {
    const inline = block('@theme inline {');
    for (const step of ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']) {
      expect(inline, `--radius-${step}`).toMatch(new RegExp(`--radius-${step}:[^;]*var\\(--radius\\)`));
    }
  });

  it('derives every letter-spacing step from the one a theme names', () => {
    const theme = block('@theme {');
    for (const step of TRACKING_STEPS) {
      expect(theme, `--tracking-${step}`).toMatch(
        new RegExp(`--tracking-${step}:\\s*calc\\(var\\(--tracking-normal\\)`),
      );
    }
  });

  it('leaves the families out of the inline block, so a palette can move them', () => {
    const inline = block('@theme inline {');
    for (const name of ['--font-sans', '--font-mono', '--font-serif']) {
      expect(inline, `${name} is inlined and would not follow a palette`).not.toMatch(
        new RegExp(`^\\s*${name}:`, 'm'),
      );
    }
  });
});

describe('the type and the letter spacing a theme names', () => {
  it('have a default on the tokens, on the page and on the stage alike', () => {
    const tokens = block(':root,\n[data-stage] {');
    for (const name of ['--font-sans', '--font-mono', '--font-serif', '--tracking-normal']) {
      expect(tokens, name).toMatch(new RegExp(`^\\s*${name}:`, 'm'));
    }
  });

  it('put the spacing on the page, as the tweakcn export writes it', () => {
    expect(globalCss).toMatch(/body\s*\{[^}]*letter-spacing:\s*var\(--tracking-normal,[^)]*\)/);
  });

  it('put it on the stage too, which wears a palette of its own', () => {
    const reset = globalCss.slice(globalCss.indexOf('@layer sg-demo-base'));
    expect(reset).toMatch(/letter-spacing:\s*var\(--tracking-normal,[^)]*\)/);
  });
});
