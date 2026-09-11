import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'errorMessage', type: '`(message: string) => ReactNode` / `Snippet<[string]>`', default: '—', meaning: 'Renders the message. Default is a small destructive line under the control.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Control height.' },
    { name: 'inline', type: '`boolean`', default: '`false`', meaning: 'The row form: the control takes the width of its value.' },
    { name: 'slotName', type: '`string`', default: '—', meaning: 'The editor\'s own `data-slot` name. Every part of the editor is addressed under it.' },
    { name: 'message', type: '`string | null`', default: '`null`', meaning: 'The line under the control, or null when there is nothing to say.' },
    { name: 'render', type: '`(props: ValueEditorRootProps, children: ReactNode) => ReactNode`', default: '—', meaning: 'Draws the root, with the attributes and classes the box carries. For an editor whose root is a primitive of its own.', only: 'react' },
  ],
} satisfies PropsFile;
