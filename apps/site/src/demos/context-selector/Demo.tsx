import { useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { ContextSelector, type WorkContext } from '@/registry/sg/components/context-selector';
import { DemoClientProvider, useSgClient } from '../_shared/react';

/* The mock's first person, as the app would pass the signed-in user. */
const currentUser: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };

function Selector() {
  const client = useSgClient();
  const [context, setContext] = useState<WorkContext>({
    project: { type: 'Project', id: 70, name: 'Blue Moon Rising' },
    entity: { type: 'Shot', id: 862, name: 'sh010_0010' },
    task: { type: 'Task', id: 5700, name: 'Comp' },
  });
  const [recents, setRecents] = useState<WorkContext[]>([
    {
      project: { type: 'Project', id: 70, name: 'Blue Moon Rising' },
      entity: { type: 'Asset', id: 1226, name: 'charAda' },
      task: { type: 'Task', id: 5730, name: 'Model' },
    },
    {
      project: { type: 'Project', id: 71, name: 'Harbour Lights' },
      entity: { type: 'Shot', id: 889, name: 'hb010_0010' },
      task: null,
    },
  ]);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Current context, with recents and Ada&apos;s tasks
        </h4>
        <ContextSelector
          client={client}
          context={context}
          currentUser={currentUser}
          recents={recents}
          onRecentsChange={setRecents}
          onContextChange={setContext}
        />
      </section>

      <p data-demo="context" className="text-muted-foreground text-sm">
        project {context.project?.name ?? '-'} / entity {context.entity?.name ?? '-'} / task{' '}
        {context.task?.name ?? '-'}
      </p>
    </div>
  );
}

export default function Demo() {
  return (
    <DemoClientProvider>
      <Selector />
    </DemoClientProvider>
  );
}
