import type { PropsFile } from './_types';

export default {
  extends: { name: 'entity-multi-picker', omit: ['entityTypes'] },
  props: [
    { name: 'placeholder', type: '`string`', default: '`\'Search for people\'`', meaning: 'Shown in the control while nothing is chosen.' },
    { name: 'value', type: '`EntityRef[]`', default: '`[]`', meaning: 'The chosen people, in the order they were ticked. Two-way in Svelte.' },
    { name: 'includeApiUsers', type: '`boolean`', default: '`true`', meaning: 'Search script accounts alongside people.' },
    { name: 'includeInactive', type: '`boolean`', default: '`false`', meaning: 'Offer people whose status is `dis`.' },
  ],
} satisfies PropsFile;
