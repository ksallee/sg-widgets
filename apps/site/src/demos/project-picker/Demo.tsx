import { useMemo, useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { ProjectMultiPicker, ProjectPicker } from '@/registry/sg/components/project-picker';
import { createDemoContext } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
// One control per row, full width of the pane, its caption on the line above.
const field = 'flex w-full flex-col gap-2';
const stack = 'flex flex-col gap-4';
const caption = 'text-muted-foreground text-xs';

const SIZES = [
  { size: 'sm', caption: 'Small' },
  { size: 'md', caption: 'Medium, the default' },
  { size: 'lg', caption: 'Large' },
] as const;

export default function ProjectPickerDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const client = context.client;
  // The name is the mock's. A live project arrives bare and the picker resolves it.
  const preset: EntityRef = context.live
    ? { type: 'Project', id: context.projectId }
    : { type: 'Project', id: context.projectId, name: 'Blue Moon Rising' };

  const [one, setOne] = useState<EntityRef | null>(null);
  const [several, setSeveral] = useState<EntityRef[]>([]);
  const [archived, setArchived] = useState<EntityRef | null>(null);
  // A bare reference: type and id, no name. Resolved on mount.
  const [bare, setBare] = useState<EntityRef | null>({ type: 'Project', id: context.projectFor(71) });

  return (
    <div className="flex flex-col gap-3">
      <section className={group} data-demo-case="single">
        <h4 className={label}>One project</h4>
        <div className={field}>
          <span className={caption}>One project, clearable</span>
          <ProjectPicker client={client} value={one} onValueChange={setOne} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="multi">
        <h4 className={label}>Several, with checkbox rows</h4>
        <div className={field}>
          <span className={caption}>Several projects at once</span>
          <ProjectMultiPicker client={client} value={several} onValueChange={setSeveral} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="archived">
        <h4 className={label}>Archived projects included</h4>
        <div className={field}>
          <span className={caption}>Archived projects included</span>
          <ProjectPicker client={client} includeArchived value={archived} onValueChange={setArchived} />
        </div>
      </section>

      <section className={group} data-demo-case="hydrate">
        <h4 className={label}>Bare reference, resolved on mount</h4>
        <div className={field}>
          <span className={caption}>Type and id in, name resolved on mount</span>
          <ProjectPicker client={client} value={bare} onValueChange={setBare} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Sizes, then disabled, read-only, invalid</h4>
        <div className={stack}>
          {SIZES.map(({ size, caption: sizeCaption }) => (
            <div className={field} key={size}>
              <span className={caption}>{sizeCaption}</span>
              <ProjectPicker client={client} value={preset} size={size} />
            </div>
          ))}
          <div className={field}>
            <span className={caption}>Disabled</span>
            <ProjectPicker client={client} value={preset} disabled />
          </div>
          <div className={field}>
            <span className={caption}>Read-only</span>
            <ProjectPicker client={client} value={preset} readOnly />
          </div>
          <div className={field}>
            <span className={caption}>Invalid</span>
            <ProjectPicker client={client} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
