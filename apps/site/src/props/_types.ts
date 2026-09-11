/**
 * The shape of one registry item's props file.
 *
 * One file per item, holding the rows that item declares itself. A wrapper names its
 * base with `extends` and carries only its own rows, the rows it overrides and the
 * names it does not pass on. `<Props>` resolves the chain and draws the whole surface
 * on every page; `apps/site/test/props.test.ts` checks it against both components.
 */

/** A row that exists in one framework only. */
export type Framework = 'react' | 'svelte';

export interface PropRow {
  /** The prop name. Two spellings are written `class` / `className`. */
  name: string;
  type: string;
  default?: string;
  meaning?: string;
  only?: Framework;
}

export interface EventRow {
  name: string;
  payload: string;
  when: string;
  only?: Framework;
}

export interface SlotRow {
  /** The Svelte snippet name, and the React prop when the two agree. */
  name: string;
  /** The React prop, where it is spelled differently. */
  react?: string;
  receives?: string;
  draws?: string;
}

export interface KeyRow {
  key: string;
  does: string;
}

export interface PropsFile {
  /** The docs page these rows are drawn on. Defaults to the item's own name. */
  page?: string;
  /** The item this one is built on, and the base rows it does not pass on. */
  extends?: { name: string; omit?: string[] };
  /**
   * The type each framework declares, when it is not the default
   * (`<Pascal>Props` in React, the `Props` of the `$props()` destructure in Svelte).
   * `false` for an item that is a hook, a class list or a map rather than a component.
   */
  declares?: false | { react?: string; svelte?: string };
  props?: PropRow[];
  events?: EventRow[];
  slots?: SlotRow[];
  keyboard?: KeyRow[];
}
