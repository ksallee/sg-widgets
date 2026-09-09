import { useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { ProjectMultiPicker, ProjectPicker } from '@/registry/sg/components/project-picker';
import { getDemoClient } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const field = 'flex max-w-sm flex-col gap-2';

const preset: EntityRef = { type: 'Project', id: 70, name: 'Blue Moon Rising' };
const SIZES = ['sm', 'md', 'lg'] as const;

export default function ProjectPickerDemo() {
  const client = getDemoClient();

  const [one, setOne] = useState<EntityRef | null>(null);
  const [several, setSeveral] = useState<EntityRef[]>([]);
  const [archived, setArchived] = useState<EntityRef | null>(null);
  // A bare reference: type and id, no name. Resolved on mount.
  const [bare, setBare] = useState<EntityRef | null>({ type: 'Project', id: 71 });

  return (
    <div className="flex flex-col gap-4">
      <section className={group} data-demo-case="single">
        <h4 className={label}>One project</h4>
        <div className={field}>
          <ProjectPicker client={client} value={one} onValueChange={setOne} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="multi">
        <h4 className={label}>Several, with checkbox rows</h4>
        <div className={field}>
          <ProjectMultiPicker client={client} value={several} onValueChange={setSeveral} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="archived">
        <h4 className={label}>Archived projects included</h4>
        <div className={field}>
          <ProjectPicker client={client} includeArchived value={archived} onValueChange={setArchived} />
        </div>
      </section>

      <section className={group} data-demo-case="hydrate">
        <h4 className={label}>Bare reference, resolved on mount</h4>
        <div className={field}>
          <ProjectPicker client={client} value={bare} onValueChange={setBare} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Sizes, then disabled, read-only, invalid</h4>
        <div className="flex flex-col gap-2">
          {SIZES.map((size) => (
            <div className={field} key={size}>
              <ProjectPicker client={client} value={preset} size={size} />
            </div>
          ))}
          <div className={field}>
            <ProjectPicker client={client} value={preset} disabled />
          </div>
          <div className={field}>
            <ProjectPicker client={client} value={preset} readOnly />
          </div>
          <div className={field}>
            <ProjectPicker client={client} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
