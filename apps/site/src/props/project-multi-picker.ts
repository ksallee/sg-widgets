import type { PropsFile } from './_types';

export default {
  extends: { name: 'entity-multi-picker', omit: ['entityTypes'] },
  props: [
    { name: 'placeholder', type: '`string`', default: '`\'Search for projects\'`', meaning: 'Shown in the control while nothing is chosen.' },
    { name: 'value', type: '`EntityRef[]`', default: '`[]`', meaning: 'The chosen projects, in the order they were ticked. Two-way in Svelte.' },
    { name: 'includeArchived', type: '`boolean`', default: '`false`', meaning: 'Offer projects whose `archived` checkbox is set.' },
  ],
} satisfies PropsFile;
