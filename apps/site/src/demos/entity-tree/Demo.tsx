import { useMemo, useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { EntityTree, type TreeNode } from '@/registry/sg/components/entity-tree';
import { createDemoContext } from '../_shared/client';
import { DemoClientProvider } from '../_shared/react';

export default function EntityTreeDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [picked, setPicked] = useState<TreeNode | null>(null);
  const [checked, setChecked] = useState<EntityRef[]>([]);

  return (
    <DemoClientProvider client={context.client}>
      <div className="flex w-full min-w-0 flex-col gap-3">
        <EntityTree
          client={context.client}
          rootPath="/Project/70"
          seedPath="/Project/70/Shot/sg_sequence/Sequence/100/id/862"
          checkable
          filterable
          onSelect={setPicked}
          onCheckedChange={setChecked}
        />
        <p className="text-muted-foreground text-xs">
          <span data-testid="picked">{picked ? picked.label : 'nothing selected'}</span>
          <span className="tabular-nums" data-testid="checked-count">
            , {checked.length} checked
          </span>
        </p>
      </div>
    </DemoClientProvider>
  );
}
