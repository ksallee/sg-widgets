import { useMemo, useState } from 'react';
import type { EntityRef } from 'sg-widgets-core';
import { Button } from '@/components/ui/button';
import { CONTROL_BUTTON, type ControlSize } from '@/registry/sg/components/control-classes';
import { GlobalSearch } from '@/registry/sg/components/global-search';
import { createDemoContext } from '../_shared/client';

const TYPES = ['Shot', 'Asset', 'Sequence', 'Task', 'Version', 'HumanUser', 'Project'];
const SHOTS = ['Shot'];
const SIZES: ControlSize[] = ['sm', 'md', 'lg'];

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

export default function Demo() {
  const context = useMemo(() => createDemoContext(), []);
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
          context={context}
          entityTypes={TYPES}
          hotkey="."
          recents={recents}
          onRecentsChange={setRecents}
          onSelect={setPicked}
          label="Search the site"
        />
      </section>

      <section className={group}>
        <h4 className={label}>Inline, scoped to one project</h4>
        <GlobalSearch
          context={context}
          entityTypes={TYPES}
          projectId={context.projectId}
          inline
          onSelect={setPicked}
          placeholder="Search one project…"
        />
      </section>

      <section className={group} data-demo="anatomy">
        <h4 className={label}>The row props: a description under the label and a typed secondary</h4>
        <GlobalSearch
          context={context}
          entityTypes={SHOTS}
          inline
          subLabelField="description"
          secondaryField="sg_status_list"
          onSelect={(entity) => setPicked(entity)}
          placeholder="Search shots…"
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

      <section className={group}>
        <h4 className={label}>Sizes, each beside a button of the same step</h4>
        {SIZES.map((size) => (
          <div key={size} className="flex flex-wrap items-start gap-3" data-demo={`size-${size}`}>
            <div className="w-64">
              <GlobalSearch context={context} entityTypes={TYPES} size={size} label="Search the site" />
            </div>
            <Button variant="outline" size={CONTROL_BUTTON[size]}>
              Button
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
