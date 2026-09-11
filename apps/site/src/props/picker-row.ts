import type { PropsFile } from './_types';

export default {
  page: 'picker-control',
  props: [
    { name: 'row', type: '`PickerRow`', default: '—', meaning: 'The row to draw: the reference, its label and the values a read answered.' },
    { name: 'query', type: '`string`', default: '`\'\'`', meaning: 'The query whose matched runs are bold.' },
    { name: 'crumbs', type: '`string[]`', default: '`[]`', meaning: 'Crumbs drawn before the label, muted and separated by `›`.' },
    { name: 'thumbnail', type: '`string | false`', default: '`\'image\'`', meaning: 'Field holding the thumbnail URL. `false` hides the leading slot.' },
    { name: 'roundThumbnail', type: '`boolean`', default: '`false`' },
    { name: 'showCode', type: '`boolean`', default: '`false`', meaning: 'Show the row\'s code beside the label when the two differ.' },
    { name: 'subLabelField', type: '`FieldSpec | null`', default: '`null`', meaning: 'The muted line under the label: a path, or a resolved column.' },
    { name: 'subLabel', type: '`string`', default: '—', meaning: 'The muted line of the caller\'s own making. Wins over `subLabelField`.' },
    { name: 'secondaryField', type: '`FieldSpec | null`', default: '`null`', meaning: 'The right-aligned value: a path, or a resolved column so it renders by its type.' },
    { name: 'secondary', type: '`string`', default: '—', meaning: 'Right-aligned text of the caller\'s own making. Wins over `secondaryField`.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Picture and text ladder.' },
    { name: 'context', type: '`SgContext`', default: '—', meaning: 'The secondary\'s schema and the status table are read through it.' },
    { name: 'siteUrl', type: '`string`', default: 'the context\'s', meaning: 'The site the status sprite is served from.' },
    { name: 'indicatorSlot', type: '`string`', default: '`\'picker-row-indicator\'`', meaning: 'The `data-slot` the indicator column carries.' },
  ],
  slots: [
    { name: 'glyph', receives: 'nothing', draws: 'The leading slot when the row carries no picture. A row whose type is a person draws an avatar there instead.' },
    { name: 'indicator', receives: 'nothing', draws: 'The tick or the checkbox in the indicator column. The column is drawn only where a widget passes one.' },
  ],
} satisfies PropsFile;
