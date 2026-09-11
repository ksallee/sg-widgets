import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'name', type: '`string`', default: 'required', meaning: 'Display name. Drives the initials, the tooltip and the accessible name.' },
    { name: 'image', type: '`string | null`', default: '`null`', meaning: 'The user\'s image field.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Diameters 6, 8 and 10.' },
    { name: 'inactive', type: '`boolean`', default: '`false`', meaning: 'Dims and desaturates without hiding.' },
    { name: 'color', type: '`\'auto\' | \'none\'`', default: '`\'none\'`', meaning: '`auto` tints the initials with a hue derived from the name, the same one every time, readable in light and dark under any theme.' },
    { name: 'apiUser', type: '`boolean`', default: '`false`', meaning: 'Draws a bot glyph instead of a picture or initials, and names the script account in the tooltip.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
} satisfies PropsFile;
