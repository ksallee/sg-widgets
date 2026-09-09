import { useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { EntityPicker } from '@/registry/sg/components/entity-picker';
import { createDemoClient, getDemoClient } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const field = 'flex max-w-sm flex-col gap-2';
const linkish =
  'text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const preset: EntityRef = { type: 'Asset', id: 1226, name: 'charAda' };
const SIZES = ['sm', 'md', 'lg'] as const;

export default function EntityPickerDemo() {
  const client = getDemoClient();
  // Its own client, so arming a failure cannot land in another demo on the page.
  const [failing] = useState(() => createDemoClient());

  const [shot, setShot] = useState<EntityRef | null>(null);
  const [anything, setAnything] = useState<EntityRef | null>(null);
  const [inProject, setInProject] = useState<EntityRef | null>(null);
  // A bare reference: type and id, no name. Resolved on mount by one id-in read.
  const [bare, setBare] = useState<EntityRef | null>({ type: 'Shot', id: 866 });
  const [paged, setPaged] = useState<EntityRef | null>(null);
  const [failed, setFailed] = useState<EntityRef | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <section className={group} data-demo-case="single">
        <h4 className={label}>One shot</h4>
        <div className={field}>
          <EntityPicker client={client} entityTypes={['Shot']} value={shot} onValueChange={setShot} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="multi-type">
        <h4 className={label}>Three types at once</h4>
        <div className={field}>
          <EntityPicker
            client={client}
            entityTypes={['Shot', 'Asset', 'Sequence']}
            value={anything}
            onValueChange={setAnything}
            placeholder="Search shots, assets and sequences…"
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="project">
        <h4 className={label}>Scoped to one project</h4>
        <div className={field}>
          <EntityPicker
            client={client}
            entityTypes={['Shot']}
            projectId={71}
            value={inProject}
            onValueChange={setInProject}
            placeholder="Shots on Harbour Lights…"
          />
        </div>
      </section>

      <section className={group} data-demo-case="hydrate">
        <h4 className={label}>Bare reference, resolved on mount</h4>
        <div className={field}>
          <EntityPicker client={client} entityTypes={['Shot']} value={bare} onValueChange={setBare} clearable />
          <button
            type="button"
            className={`${linkish} self-start`}
            onClick={() => setBare({ type: 'Asset', id: 1229 })}
          >
            Hand in another bare reference
          </button>
        </div>
      </section>

      <section className={group} data-demo-case="more">
        <h4 className={label}>Five a page, with a load more row</h4>
        <div className={field}>
          <EntityPicker
            client={client}
            entityTypes={['Shot']}
            pageSize={5}
            value={paged}
            onValueChange={setPaged}
          />
        </div>
      </section>

      <section className={group} data-demo-case="error">
        <h4 className={label}>Error state</h4>
        <div className={field}>
          <EntityPicker
            client={failing.client}
            entityTypes={['Shot']}
            value={failed}
            onValueChange={setFailed}
            onError={(error) => setLastError(error.message)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={linkish}
              data-arm-failure
              onClick={() => failing.mock.failNext({ status: 503, message: 'Flow PT API error 503' })}
            >
              Arm the next call to fail
            </button>
            {lastError ? <span className="text-destructive text-xs">{lastError}</span> : null}
          </div>
        </div>
      </section>

      <section className={group} data-demo-case="sizes">
        <h4 className={label}>Sizes</h4>
        <div className="flex flex-col gap-2">
          {SIZES.map((size) => (
            <div className={field} key={size}>
              <EntityPicker client={client} entityTypes={['Asset']} value={preset} size={size} clearable />
            </div>
          ))}
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Disabled, read-only, invalid</h4>
        <div className="flex flex-col gap-2">
          <div className={field}>
            <EntityPicker client={client} entityTypes={['Asset']} value={preset} disabled />
          </div>
          <div className={field}>
            <EntityPicker client={client} entityTypes={['Asset']} value={preset} readOnly />
          </div>
          <div className={field}>
            <EntityPicker client={client} entityTypes={['Asset']} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
