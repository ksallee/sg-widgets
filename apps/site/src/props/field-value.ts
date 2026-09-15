import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'localHref', type: '`(link: UrlLinkInfo) => string | null`', default: '—', meaning: 'Rewrites the href of a local file link. The default opens `file:`, which a browser refuses from an http page.' },
    { name: 'value', type: '`unknown`', default: 'required', meaning: 'The raw attribute or relationship value, as the API returned it.' },
    { name: 'dataType', type: '`string`', default: 'required', meaning: 'The field\'s data type. An unknown one renders as text.' },
    { name: 'field', type: '`FieldSchema | null`', default: '`null`', meaning: 'Supplies a status label through its display values.' },
    { name: 'statuses', type: '`Record<string, StatusRecord> | null`', default: '`null`', meaning: 'Status rows by code, for the status name and icon.' },
    { name: 'siteUrl', type: '`string`', default: 'the context\'s', meaning: 'The site the stock sprite is served from, and the site a linked row is addressed on.' },
    { name: 'entityVariant', type: '`\'chip\' | \'link\' | \'text\'`', default: '`\'chip\'`', meaning: 'How an entity or multi-entity value draws.' },
    { name: 'density', type: '`\'compact\' | \'default\'`', default: '`\'default\'`', meaning: 'The density of the collection around the value. Compact draws its chip and badge a step smaller.' },
    { name: 'preview', type: '`string[]`', default: '—', meaning: 'Field paths shown in a hover card on a linked row. Needs a context.' },
    { name: 'context', type: '`SgContext`', default: '—', meaning: 'The widget context: the site url, the site preferences and the hover card\'s read.' },
    { name: 'client', type: '`SgClient`', default: '—', meaning: 'A client, for an app with no context. One context is built per client and shared.' },
    { name: 'hoursPerDay', type: '`number`', default: 'the context\'s', meaning: 'The site\'s working day. Durations then render in days.' },
    { name: 'locale', type: '`string`', default: 'the context\'s, then the runtime\'s', meaning: 'Used for dates and numbers.' },
    { name: 'timeZone', type: '`string`', default: 'the context\'s, then the runtime\'s', meaning: 'IANA zone a `date_time` is shown in.' },
    { name: 'frameRate', type: '`number`', default: 'the context\'s', meaning: 'Frames a second. A timecode then carries its frame digits.' },
    { name: 'precision', type: '`number`', default: '—', meaning: 'Decimals shown on a float, zeros kept. Without it, the value as the API sent it, trailing zeros dropped. On a currency, the decimals, default 2.' },
    { name: 'currencySymbol', type: '`string`', default: '`\'$\'`', meaning: 'Shown before a currency amount.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'empty\'`', meaning: 'The marker shown for an unset value.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  keyboard: [
    { key: '`Tab`', does: 'Moves to the link, when the value is a URL field with a URL in it.' },
    { key: '`Enter`', does: 'Follows that link.' },
  ],
} satisfies PropsFile;
