import { useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { ContextSelector, type WorkContext } from '@/registry/sg/components/context-selector';
import type { DemoContext } from '../_shared/client';
import { DemoContextProvider, useSgContext } from '../_shared/react';

/* The mock's first person, as the app would pass the signed-in user. */
const currentUser: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };

/*
 * On a real site the context starts on the project the Connect panel picked, and the
 * widget's own reads fill the rest. The fixtures below are the mock's rows.
 */
function startContext(context: DemoContext): WorkContext {
  if (context.live) {
    return {
      project: { type: 'Project', id: context.projectId, name: context.projectName },
      entity: null,
      task: null,
    };
  }
  return {
    project: { type: 'Project', id: 70, name: 'Blue Moon Rising' },
    entity: { type: 'Shot', id: 862, name: 'sh010_0010' },
    task: { type: 'Task', id: 5700, name: 'Comp' },
  };
}

function startRecents(context: DemoContext): WorkContext[] {
  if (context.live) return [];
  return [
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
  ];
}

function Selector() {
  const context = useSgContext();
  const [workContext, setWorkContext] = useState<WorkContext>(() => startContext(context));
  const [recents, setRecents] = useState<WorkContext[]>(() => startRecents(context));

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Current context, with recents and Ada&apos;s tasks
        </h4>
        <ContextSelector
          context={context}
          workContext={workContext}
          currentUser={currentUser}
          recents={recents}
          onRecentsChange={setRecents}
          onWorkContextChange={setWorkContext}
        />
      </section>

      <p data-demo="context" className="text-muted-foreground text-sm">
        project {workContext.project?.name ?? '-'} / entity {workContext.entity?.name ?? '-'} /
        task{' '}
        {workContext.task?.name ?? '-'}
      </p>
    </div>
  );
}

export default function Demo() {
  return (
    <DemoContextProvider>
      <Selector />
    </DemoContextProvider>
  );
}
