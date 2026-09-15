import type { PropsFile } from './_types';

export default {
  page: 'value-editor',
  props: [
    { name: 'message', type: '`string | null`', default: '`null`', meaning: 'The message, or null when there is nothing to say.' },
    { name: 'errorMessage', type: '`(message: string) => ReactNode` / `Snippet<[string]>`', default: '—', meaning: 'Renders the message. Default is a small destructive line under the control.' },
  ],
} satisfies PropsFile;
