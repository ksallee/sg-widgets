import type { PropsFile } from './_types';

export default {
  page: 'status-badge',
  props: [
    { name: 'status', type: '`StatusRecord | null`', default: '`null`', meaning: 'The resolved `Status` row. A plain `list` field has none, so it draws no icon.' },
    { name: 'siteUrl', type: '`string`', default: '—', meaning: 'The site the stock sprite is served from, for icons the package does not bundle.' },
    { name: 'fallback', type: '`boolean`', default: '`false`', meaning: 'Draw the dot for a status that names no icon, so every row carries a leading mark.' },
    { name: 'onColor', type: '`boolean`', default: '`false`', meaning: 'The glyph sits on the status colour, which is its own ground in both schemes, so the sprite is left as it is.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Sizes the `image` drawing. A sprite cell carries its own size.' },
  ],
} satisfies PropsFile;
