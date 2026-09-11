import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'state', type: '`\'empty\' | \'error\'`', default: '—', meaning: 'Which state this is. An error is destructive, an empty state muted.' },
    { name: 'label', type: '`string`', default: '—', meaning: 'The line to show. It truncates, and carries itself as a `title`.' },
    { name: 'icon', type: '`LucideIcon | null`', default: '`null`', meaning: 'The glyph in front of the line, drawn at `size-4`.' },
    { name: 'pad', type: '`\'popover\' | \'table\' | \'none\'`', default: '`\'popover\'`', meaning: 'The room around the line: `py-6` in a popup list, `py-10` in a body, and none under rows already drawn.' },
    { name: 'slotName', type: '`string`', default: '`\'state-line\'`', meaning: 'The `data-slot` this block carries.' },
  ],
} satisfies PropsFile;
