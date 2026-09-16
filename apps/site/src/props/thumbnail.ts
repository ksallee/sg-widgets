import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'src', type: '`string | null`', default: '`null`', meaning: 'The image field\'s value.' },
    { name: 'alt', type: '`string`', default: '`\'\'`', meaning: 'Empty by default: a thumbnail beside a labelled row is decorative.' },
    { name: 'aspect', type: '`\'16:9\' | \'square\'`', default: '`\'16:9\'`', meaning: 'Sets the width for the chosen height.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\' | \'xl\' | \'2xl\'`', default: '`\'md\'`', meaning: 'Heights 6, 8, 10, 16 and 24. The first three sit in rows and cells; `xl` and `2xl` are for cards and detail panes.' },
    { name: 'entityType', type: '`string | null`', default: '`null`', meaning: 'The row\'s entity type. Its glyph stands in where there is no picture; without it a plain picture glyph does.' },
    { name: 'playable', type: '`boolean`', default: '`false`', meaning: 'Draws a centred play badge over the image.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes. Set a height here for a larger frame.' },
  ],
} satisfies PropsFile;
