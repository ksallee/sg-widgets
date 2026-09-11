import type { PropsFile } from './_types';

export default {
  page: 'search-control',
  props: [
    { name: 'label', type: '`string`', default: 'required', meaning: 'The accessible name of the block.' },
    { name: 'lines', type: '`number`', default: '`3`', meaning: 'Rows the read stands in for.' },
    { name: 'lead', type: '`string`', default: '`h-6 w-10 shrink-0`', meaning: 'The leading slot’s shape: a thumbnail, a row glyph.' },
    { name: 'slotName', type: '`string`', default: '—', meaning: 'The `data-slot` the block carries.' },
  ],
} satisfies PropsFile;
