import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'context', type: '`SgContext`', default: '—', meaning: 'The widget context: the cached client, the schema, the site url and the preferences the card reads through.' },
    { name: 'client', type: '`SgClient`', default: '—', meaning: 'A client, for an app with no context. One context is built per client and shared.' },
    { name: 'row', type: '`EntityRow | null`', default: '`null`', meaning: 'A row you already read. Given, the card reads nothing.' },
    { name: 'entity', type: '`EntityRef | null`', default: '`null`', meaning: 'The row to read, when no row is given.' },
    { name: 'fields', type: '`string[]`', default: '`[]`', meaning: 'Field paths for the grid, in order. Dotted paths allowed. Card only.' },
    { name: 'variant', type: '`\'card\' | \'tile\'`', default: '`\'card\'`', meaning: 'The stacked surface, or the thumbnail-first tile.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Thumbnail 16, 16 and 24, with the gaps and name scale to match.' },
    { name: 'imagePath', type: '`string`', default: '`\'image\'`', meaning: 'The image field the thumbnail comes from.' },
    { name: 'labelField', type: '`string | null`', default: 'the type’s display name', meaning: 'Field shown as the name. Tile only.' },
    { name: 'subLabelField', type: '`FieldSpec | null`', default: '`null`', meaning: 'The left of the tile’s metadata line, drawn by its data type: a status reads its display name.' },
    { name: 'subLabel', type: '`(row) => string`', default: '—', meaning: 'The caller’s own sub-label. Wins over `subLabelField`.' },
    { name: 'secondaryField', type: '`FieldSpec | null`', default: '`null`', meaning: 'The right of the tile’s metadata line, drawn by its data type: a status reads its display name.' },
    { name: 'secondary', type: '`(row) => string`', default: '—', meaning: 'The caller’s own text on the right of the metadata line. Wins over `secondaryField`.' },
    { name: 'showCode', type: '`boolean`', default: '`false`', meaning: 'Show the row’s `code` beside the name when the two differ. Tile only.' },
    { name: 'statuses', type: '`Record<string, StatusRecord> | null`', default: 'the context’s', meaning: '`Status` rows by code (probe 010).' },
    { name: 'selectable', type: '`boolean`', default: '`false`', meaning: 'Draws the tile’s selection checkbox and gives the tile a focus ring.' },
    { name: 'selected', type: '`boolean`', default: '`false`', meaning: 'Whether the tile is taken.' },
    { name: 'siteUrl', type: '`string`', default: 'the context\'s', meaning: 'The site the name and every linked row point at.' },
    { name: 'hoursPerDay', type: '`number`', default: 'the context\'s', meaning: 'The site\'s working day. Durations then render in days.' },
    { name: 'locale', type: '`string`', default: 'the context\'s, then the runtime\'s', meaning: 'Used for dates and numbers.' },
    { name: 'timeZone', type: '`string`', default: 'the context\'s, then the runtime\'s', meaning: 'IANA zone a `date_time` is shown in.' },
    { name: 'frameRate', type: '`number`', default: 'the context\'s', meaning: 'Frames a second. A timecode then carries its frame digits.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'empty\'`', meaning: 'What a field with no value shows.' },
    { name: 'errorLabel', type: '`string`', default: '—', meaning: 'Shown in place of what the failed read said.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  events: [
    { name: 'onSelectedChange', payload: '`boolean`', when: 'The tile\'s checkbox was toggled.' },
  ],
  slots: [
    { name: 'actions', draws: 'The thumbnail\'s top-right corner, on hover or focus. Tile only.' },
  ],
  keyboard: [
    { key: '`Tab`', does: 'On a card, moves to the name, when a site url is known, then to any link inside a field value. On a tile, moves to the checkbox and to the actions.' },
    { key: '`Enter`', does: 'Opens the row\'s page on the site, in a new tab.' },
    { key: '`Space`', does: 'Toggles the checkbox it is on.' },
  ],
} satisfies PropsFile;
