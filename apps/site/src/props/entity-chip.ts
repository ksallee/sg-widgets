import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'entity', type: '`EntityRef`', default: 'required', meaning: 'Type, id and optional name, as an entity field returns it.' },
    { name: 'thumbnail', type: '`string | null`', default: '`null`', meaning: 'Replaces the type glyph.' },
    { name: 'variant', type: '`\'chip\' | \'link\' | \'text\'`', default: '`\'chip\'`', meaning: 'Boxed chip, inline link, or the bare name.' },
    { name: 'href', type: '`string | ((ref) => string | null)`', default: 'the row\'s page on the site', meaning: 'Where the chip points.' },
    { name: 'siteUrl', type: '`string`', default: 'the context\'s', meaning: 'The site the row\'s own page lives on.' },
    { name: 'preview', type: '`string[]`', default: '—', meaning: 'Field paths shown in a hover card. Needs a context.' },
    { name: 'context', type: '`SgContext`', default: '—', meaning: 'The widget context, for the site url and for the hover card\'s read.' },
    { name: 'client', type: '`SgClient`', default: '—', meaning: 'A client, for an app with no context. One context is built per client and shared.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Heights 6, 8 and 10 for the chip; the type scale for the others.' },
    { name: 'removable', type: '`boolean`', default: '`false`', meaning: 'Shows the remove control.' },
    { name: 'removeLabel', type: '`string`', default: 'derived from the name', meaning: 'Accessible name for the remove control.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  events: [
    { name: 'onClick', payload: '`MouseEvent`', when: 'The content was pressed. It renders as a button. Ignored when a link is set. Svelte spells it `onclick`, as it does every DOM event.' },
    { name: 'onRemove', payload: '`EntityRef`', when: 'The remove control was pressed.' },
  ],
  keyboard: [
    { key: '`Tab`', does: 'Moves to the link or button, then to the remove control.' },
    { key: '`Enter`', does: 'Follows the link, or activates the button.' },
    { key: '`Space`', does: 'Activates the button or the remove control.' },
  ],
} satisfies PropsFile;
