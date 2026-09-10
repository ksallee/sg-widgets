import { useMemo, useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { EntityPicker } from '@/registry/sg/components/entity-picker';
import { createDemoClient, createDemoContext } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
// One control per row, full width of the pane, its caption on the line above.
const field = 'flex w-full flex-col gap-2';
const stack = 'flex flex-col gap-4';
const caption = 'text-muted-foreground text-xs';
const linkish =
  'text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const preset: EntityRef = { type: 'Asset', id: 1226, name: 'charAda' };
const SIZES = [
  { size: 'sm', caption: 'Small' },
  { size: 'md', caption: 'Medium, the default' },
  { size: 'lg', caption: 'Large' },
] as const;

export default function EntityPickerDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const client = context.client;
  // Its own client, so arming a failure cannot land in another demo on the page.
  const [failing] = useState(() => createDemoClient());

  const [shot, setShot] = useState<EntityRef | null>(null);
  const [withStatus, setWithStatus] = useState<EntityRef | null>(null);
  const [anything, setAnything] = useState<EntityRef | null>(null);
  const [custom, setCustom] = useState<EntityRef | null>(null);
  const [inProject, setInProject] = useState<EntityRef | null>(null);
  // A bare reference: type and id, no name. Resolved on mount by one id-in read.
  const [bare, setBare] = useState<EntityRef | null>({ type: 'Shot', id: 866 });
  const [plain, setPlain] = useState<EntityRef | null>(null);
  const [anatomy, setAnatomy] = useState<EntityRef | null>(null);
  const [paged, setPaged] = useState<EntityRef | null>(null);
  const [failed, setFailed] = useState<EntityRef | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <section className={group} data-demo-case="single">
        <h4 className={label}>One shot</h4>
        <div className={field}>
          <span className={caption}>One shot, clearable</span>
          <EntityPicker client={client} entityTypes={['Shot']} value={shot} onValueChange={setShot} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="status-secondary">
        <h4 className={label}>Status as secondary</h4>
        <div className={field}>
          <span className={caption}>Status on the right of every row</span>
          <EntityPicker
            client={client}
            entityTypes={['Shot']}
            secondaryField="sg_status_list"
            value={withStatus}
            onValueChange={setWithStatus}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="multi-type">
        <h4 className={label}>Three types at once, the type on the right</h4>
        <div className={field}>
          <span className={caption}>Shots, assets and sequences in one list</span>
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

      <section className={group} data-demo-case="custom-secondary">
        <h4 className={label}>Custom secondary</h4>
        <div className={field}>
          <span className={caption}>The id, rendered by the caller</span>
          <EntityPicker
            client={client}
            entityTypes={['Shot']}
            secondary={(row) => `#${row.id}`}
            value={custom}
            onValueChange={setCustom}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="project">
        <h4 className={label}>Scoped to one project</h4>
        <div className={field}>
          <span className={caption}>Scoped to one project</span>
          <EntityPicker
            client={client}
            entityTypes={['Shot']}
            projectId={context.projectFor(71)}
            value={inProject}
            onValueChange={setInProject}
            placeholder="Shots on one project…"
          />
        </div>
      </section>

      <section className={group} data-demo-case="hydrate">
        <h4 className={label}>Bare reference, resolved on mount</h4>
        <div className={field}>
          <span className={caption}>Type and id in, name resolved on mount</span>
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
          <span className={caption}>Five a page</span>
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
          <span className={caption}>Reads a client whose next call can be armed to fail</span>
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

      <section className={group} data-demo-case="anatomy">
        <h4 className={label}>Row anatomy: no thumbnail, a sub-label, the code beside the name</h4>
        <div className={stack}>
          <div className={field}>
            <span className={caption}>No thumbnail</span>
            <EntityPicker
              client={client}
              entityTypes={['Shot']}
              thumbnail={false}
              value={plain}
              onValueChange={setPlain}
              clearable
            />
          </div>
          <div className={field}>
            <span className={caption}>A sub-label, and the code beside the name</span>
            <EntityPicker
              client={client}
              entityTypes={['Version']}
              subLabelField="sg_status_list"
              secondaryField="id"
              showCode
              value={anatomy}
              onValueChange={setAnatomy}
              clearable
            />
          </div>
        </div>
      </section>

      <section className={group} data-demo-case="sizes">
        <h4 className={label}>Sizes</h4>
        <div className={stack}>
          {SIZES.map(({ size, caption: sizeCaption }) => (
            <div className={field} key={size}>
              <span className={caption}>{sizeCaption}</span>
              <EntityPicker client={client} entityTypes={['Asset']} value={preset} size={size} clearable />
            </div>
          ))}
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Disabled, read-only, invalid</h4>
        <div className={stack}>
          <div className={field}>
            <span className={caption}>Disabled</span>
            <EntityPicker client={client} entityTypes={['Asset']} value={preset} disabled />
          </div>
          <div className={field}>
            <span className={caption}>Read-only</span>
            <EntityPicker client={client} entityTypes={['Asset']} value={preset} readonly />
          </div>
          <div className={field}>
            <span className={caption}>Invalid</span>
            <EntityPicker client={client} entityTypes={['Asset']} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
