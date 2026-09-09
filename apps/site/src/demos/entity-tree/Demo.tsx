import { useMemo, useState } from 'react';
import type { EntityRef, TreeNode } from '@sg-widgets/core';
import { EntityTree } from '@/registry/sg/components/entity-tree';
import { createDemoContext } from '../_shared/client';
import { DemoClientProvider } from '../_shared/react';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

export default function EntityTreeDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [picked, setPicked] = useState<TreeNode | null>(null);
  const [checked, setChecked] = useState<EntityRef[]>([]);

  const rootPath = `/Project/${context.projectId}`;
  const seedPath = context.live ? null : `${rootPath}/Shot/sg_sequence/Sequence/100/id/862`;

  return (
    <DemoClientProvider client={context.client}>
      <div className="flex w-full min-w-0 flex-col gap-4">
        <section className={group}>
          <h4 className={label}>A project, seeded open, with checkboxes</h4>
          <EntityTree
            client={context.client}
            rootPath={rootPath}
            seedPath={seedPath}
            checkable
            filterable
            showCode
            onSelect={setPicked}
            onCheckedChange={setChecked}
          />
          <p className="text-muted-foreground text-xs">
            <span data-testid="picked">{picked ? picked.label : 'nothing selected'}</span>
            <span className="tabular-nums" data-testid="checked-count">
              , {checked.length} checked
            </span>
          </p>
        </section>

        <section className={group}>
          <h4 className={label}>The same tree with thumbnails</h4>
          <EntityTree
            client={context.client}
            rootPath={rootPath}
            thumbnail="image"
            subLabelField="description"
            maxHeight="16rem"
            data-testid="thumbnail-tree"
          />
        </section>
      </div>
    </DemoClientProvider>
  );
}
