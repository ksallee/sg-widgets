import { useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { GlobalSearch } from '@/registry/sg/components/global-search';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const TYPES = ['Shot', 'Asset', 'Sequence', 'Task', 'Version', 'HumanUser', 'Project'];

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

function Searches() {
  const client = useSgClient();
  /* Prefilled so the palette has something to show before a word is typed. */
  const [recents, setRecents] = useState<EntityRef[]>([
    { type: 'Shot', id: 862, name: 'sh010_0010' },
    { type: 'Asset', id: 1226, name: 'charAda' },
    { type: 'Project', id: 70, name: 'Blue Moon Rising' },
  ]);
  const [picked, setPicked] = useState<EntityRef | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <section className={group}>
        <h4 className={label}>Palette, opened by the trigger or Cmd/Ctrl+K</h4>
        <GlobalSearch
          client={client}
          entityTypes={TYPES}
          hotkey
          recents={recents}
          onRecentsChange={setRecents}
          onSelect={setPicked}
          label="Search the site"
        />
      </section>

      <section className={group}>
        <h4 className={label}>Inline, scoped to one project</h4>
        <GlobalSearch
          client={client}
          entityTypes={TYPES}
          projectId={70}
          inline
          onSelect={setPicked}
          placeholder="Search Blue Moon Rising…"
        />
      </section>

      <p data-demo="picked" className="text-muted-foreground text-sm">
        {picked ? (
          <>
            Selected{' '}
            <span className="text-foreground font-medium">
              {picked.type} {picked.id}
            </span>{' '}
            {picked.name}
          </>
        ) : (
          'Nothing selected yet.'
        )}
      </p>
    </div>
  );
}

export default function Demo() {
  return (
    <DemoClientProvider>
      <Searches />
    </DemoClientProvider>
  );
}
