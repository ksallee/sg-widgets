import { useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { HierarchicalSearch } from '@/registry/sg/components/hierarchical-search';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { DemoClientProvider, useSgClient } from '../_shared/react';

function Tree() {
  const client = useSgClient();
  const [picked, setPicked] = useState<{ leaf: EntityRef; path: EntityRef[] } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Scoped to Blue Moon Rising
        </h4>
        <HierarchicalSearch
          client={client}
          rootPath="/Project/70"
          entityTypes={['Shot', 'Asset', 'Sequence', 'Task']}
          onSelect={(leaf, path) => setPicked({ leaf, path })}
        />
      </section>

      <div data-demo="picked" className="flex flex-wrap items-center gap-2">
        {picked ? (
          <>
            {picked.path.map((step) => (
              <EntityChip key={`${step.type}:${step.id}`} entity={step} size="sm" />
            ))}
            <span className="text-muted-foreground text-sm">
              leaf {picked.leaf.type} {picked.leaf.id}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">Nothing selected yet.</span>
        )}
      </div>
    </div>
  );
}

export default function Demo() {
  return (
    <DemoClientProvider>
      <Tree />
    </DemoClientProvider>
  );
}
