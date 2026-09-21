import type { PropsFile } from './_types';

export default {
  extends: { name: 'entity-picker', omit: ['entityTypes'] },
  props: [
    { name: 'placeholder', type: '`string`', default: '`\'Search for a project\'`', meaning: 'Shown in the control while nothing is chosen.' },
    { name: 'includeArchived', type: '`boolean`', default: '`false`', meaning: 'Offer projects whose `archived` checkbox is set.' },
  ],
  events: [
    { name: 'onValueChange', payload: '`EntityRef | null`, `PickerRow | null`', when: 'The selection changed.' },
  ],
} satisfies PropsFile;
