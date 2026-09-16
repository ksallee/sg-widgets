import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'code', type: '`string`', default: 'required', meaning: 'The stored status code. An empty code renders nothing.' },
    { name: 'status', type: '`StatusRecord | null`', default: '`null`', meaning: 'The resolved Status row. Supplies the name, colour and icon.' },
    { name: 'field', type: '`FieldSchema | null`', default: '`null`', meaning: 'Fallback label source, through its display values.' },
    { name: 'variant', type: '`\'both\' | \'icon\' | \'text\' | \'glyph\'`', default: '`\'both\'`', meaning: 'Icon-only and glyph keep the label as screen-reader text and a tooltip.' },
    { name: 'size', type: '`\'xs\' | \'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Heights 5, 6, 8 and 10.' },
    { name: 'color', type: '`boolean`', default: '`false`', meaning: 'Paints the badge in the status colour instead of the neutral surface.' },
    { name: 'label', type: '`\'name\' | \'code\'`', default: '`\'name\'`', meaning: 'Which of the two the badge shows. The other one is the tooltip.' },
    { name: 'siteUrl', type: '`string`', default: '—', meaning: 'The site the stock sprite is served from. Needed only for a sprite cell outside the status icon set.' },
    { name: 'removable', type: '`boolean`', default: '`false`', meaning: 'Draws a remove control inside the pill, after the label. `variant="icon"` and `variant="glyph"` have no room for it and ignore this.' },
    { name: 'onRemove', type: '`(code: string) => void`', default: '—', meaning: 'Fires with the code when the remove control is pressed.' },
    { name: 'removeLabel', type: '`string`', default: '`Remove <label>`', meaning: 'The accessible name of the remove control.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  keyboard: [
    { key: '<kbd>Tab</kbd>', does: 'Reaches the remove control of a removable badge. The badge itself is not focusable' },
    { key: '<kbd>Enter</kbd> / <kbd>Space</kbd>', does: 'Removes, from that control' },
  ],
} satisfies PropsFile;
