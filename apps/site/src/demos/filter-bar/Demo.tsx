import { useEffect, useState } from 'react';
import type { FilterGroup } from '@sg-widgets/core';
import { emptyFilter, toApi3Hash } from '@sg-widgets/core';
import { FilterBar } from '@/registry/sg/components/filter-bar';
import { DemoClientProvider, useSgClient } from '../_shared/react';

function Bar() {
  const client = useSgClient();
  const [value, setValue] = useState<FilterGroup>(emptyFilter);
  const [matching, setMatching] = useState<number | null>(null);

  const scope = JSON.stringify(toApi3Hash(value));

  // `_search` answers no total, so the demo counts the rows it read. The site has
  // 40 shots, well under one page.
  useEffect(() => {
    let live = true;
    setMatching(null);
    void client
      .search('Shot', { filters: JSON.parse(scope), fields: ['code'], page: { size: 200 } })
      .then((result) => {
        if (live) setMatching(result.data.length);
      });
    return () => {
      live = false;
    };
  }, [client, scope]);

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        entityType="Shot"
        client={client}
        facets={['sg_status_list', 'sg_sequence', 'sg_shot_type']}
        value={value}
        onChange={setValue}
      />

      <p className="text-muted-foreground text-sm" data-testid="matching">
        {matching === null ? 'Counting shots…' : `${matching} matching ${matching === 1 ? 'shot' : 'shots'}`}
      </p>
    </div>
  );
}

export default function FilterBarDemo() {
  return (
    <DemoClientProvider>
      <Bar />
    </DemoClientProvider>
  );
}
