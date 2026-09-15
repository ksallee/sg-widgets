import type { PropsFile } from './_types';

export default {
  extends: { name: 'entity-picker', omit: ['entityTypes'] },
  props: [
    { name: 'placeholder', type: '`string`', default: '`\'Search for a person\'`', meaning: 'Shown in the control while nothing is chosen.' },
    { name: 'includeApiUsers', type: '`boolean`', default: '`true`', meaning: 'Search script accounts alongside people.' },
    { name: 'includeInactive', type: '`boolean`', default: '`false`', meaning: 'Offer people whose status is `dis`.' },
  ],
  events: [
    { name: 'onValueChange', payload: '`EntityRef`, `PickerRow`', when: 'The selection changed.' },
  ],
} satisfies PropsFile;
