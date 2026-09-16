import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'text', type: '`string`', default: 'required', meaning: 'The label to draw.' },
    { name: 'query', type: '`string`', default: '`\'\'`', meaning: 'What was searched for. Its whitespace-separated words are the ones marked.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
} satisfies PropsFile;
