import type { PropsFile } from './_types';

export default {
  page: 'collection-control',
  props: [
    { name: 'slotName', type: '`string`', default: 'required', meaning: 'The widget\'s own name, which prefixes every `data-slot` in the footer.' },
    { name: 'source', type: '`EntitySource`', default: 'required', meaning: 'The source the page size, the arrows and the page number drive.' },
    { name: 'pager', type: '`PageRange`', default: 'required', meaning: 'The numbers to draw, from core\'s `describePaging`.' },
    { name: 'loading', type: '`boolean`', default: 'required', meaning: 'True while the set is being read: the arrows wait for it.' },
    { name: 'pageSizes', type: '`number[]`', default: 'required', meaning: 'The page sizes offered in `pages` mode.' },
  ],
} satisfies PropsFile;
