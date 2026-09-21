import type { PropsFile } from './_types';

export default {
  page: 'collection-control',
  props: [
    { name: 'slotName', type: '`string`', default: '—', meaning: 'The widget\'s own name, which prefixes every `data-slot` in the footer.' },
    { name: 'source', type: '`EntitySource`', default: '—', meaning: 'The source the page size, the arrows and the page number drive.' },
    { name: 'pager', type: '`PageRange`', default: '—', meaning: 'The numbers to draw, from core\'s `describePaging`.' },
    { name: 'loading', type: '`boolean`', default: '—', meaning: 'True while the set is being read: the arrows wait for it.' },
    { name: 'pageSizes', type: '`number[]`', default: '—', meaning: 'The page sizes offered in `pages` mode.' },
  ],
} satisfies PropsFile;
