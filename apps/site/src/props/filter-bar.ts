import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'baseFilter', type: '`FilterGroup | WireGroup | null`', default: '`null`', meaning: 'Conditions every facet query carries, such as a project scope. Never edited by the bar.' },
    { name: 'entityType', type: '`string`', default: 'required', meaning: 'Type the pills and the counts read on.' },
    { name: 'context', type: '`SgContext`', default: 'required', meaning: 'The widget context. Every read goes through it, so widgets on a page share one cache.' },
    { name: 'facets', type: '`string[]`', default: 'required', meaning: 'Field names to offer as pills, in order.' },
    { name: 'labels', type: '`Record<string, string>`', default: '`{}`', meaning: 'A name per facet, for a field whose schema label is not what the page calls it.' },
    { name: 'maxValues', type: '`number`', default: '`2`', meaning: 'Values a pill names before the rest reads as `+n`. `0` names every one.' },
    { name: 'value', type: '`FilterGroup`', default: '`emptyFilter()`', meaning: 'The tree the pills write into. Two-way in Svelte through `bind:value`.' },
    { name: 'counts', type: '`(field, filters) => Promise<Record<string, number>>`', default: '—', meaning: 'Counts per value for one facet. Wire it to a `_summarize` grouping call.' },
    { name: 'sampleSize', type: '`number`', default: '`200`', meaning: 'Rows read for the tally when `counts` is not given.' },
    { name: 'hidePaths', type: '`string[]`', default: '`[]`', meaning: 'Passed through to the dialog.' },
    { name: 'disabled', type: '`boolean`', default: '`false`', meaning: 'Blocks every pill.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Pill heights 7, 8 and 9.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  events: [
    { name: 'onChange', payload: '`FilterGroup`', when: 'The tree changed, on every tick and on Apply in the dialog. Svelte also binds it with `bind:value`.' },
  ],
  keyboard: [
    { key: '`Tab`', does: 'Moves from pill to pill, and to a pill\'s remove control.' },
    { key: '`Enter`, `Space`', does: 'Opens the value list under the cursor.' },
    { key: '`Arrow` keys', does: 'Move the cursor in the open list.' },
    { key: '`Enter`', does: 'Ticks and unticks the value under the cursor.' },
    { key: '`Escape`', does: 'Closes the open list.' },
  ],
} satisfies PropsFile;
