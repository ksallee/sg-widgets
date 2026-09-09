import { useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { EntityMultiPicker } from '@/registry/sg/components/entity-multi-picker';
import { createDemoClient, getDemoClient } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const field = 'flex max-w-sm flex-col gap-2';
const linkish =
  'text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

/** Rows already on the team, kept out of the results by the server filter. */
const alreadyThere: EntityRef[] = [
  { type: 'Shot', id: 862, name: 'sh010_0010' },
  { type: 'Shot', id: 863, name: 'sh010_0020' },
];
const preset: EntityRef[] = [
  { type: 'Asset', id: 1226, name: 'charAda' },
  { type: 'Asset', id: 1227, name: 'charBruno' },
];
const SIZES = ['sm', 'md', 'lg'] as const;

export default function EntityMultiPickerDemo() {
  const client = getDemoClient();
  // Its own client, so arming a failure cannot land in another demo on the page.
  const [failing] = useState(() => createDemoClient());

  const [shots, setShots] = useState<EntityRef[]>([]);
  const [withStatus, setWithStatus] = useState<EntityRef[]>([]);
  const [anything, setAnything] = useState<EntityRef[]>([]);
  const [custom, setCustom] = useState<EntityRef[]>([]);
  // Bare references: type and id, no name. Resolved on mount, one read per type.
  const [bare, setBare] = useState<EntityRef[]>([
    { type: 'Shot', id: 866 },
    { type: 'Asset', id: 1226 },
  ]);
  const [excluding, setExcluding] = useState<EntityRef[]>([]);
  const [paged, setPaged] = useState<EntityRef[]>([]);
  const [failed, setFailed] = useState<EntityRef[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <section className={group} data-demo-case="multi">
        <h4 className={label}>Several shots</h4>
        <div className={field}>
          <EntityMultiPicker
            client={client}
            entityTypes={['Shot']}
            value={shots}
            onValueChange={setShots}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="status-secondary">
        <h4 className={label}>Status as secondary</h4>
        <div className={field}>
          <EntityMultiPicker
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
        <h4 className={label}>Three types at once, the type under the name</h4>
        <div className={field}>
          <EntityMultiPicker
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
          <EntityMultiPicker
            client={client}
            entityTypes={['Shot']}
            secondary={(row) => `#${row.id}`}
            value={custom}
            onValueChange={setCustom}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="hydrate">
        <h4 className={label}>Bare references, resolved on mount</h4>
        <div className={field}>
          <EntityMultiPicker
            client={client}
            entityTypes={['Shot', 'Asset']}
            value={bare}
            onValueChange={setBare}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="exclude">
        <h4 className={label}>Two shots excluded from the results</h4>
        <div className={field}>
          <EntityMultiPicker
            client={client}
            entityTypes={['Shot']}
            exclude={alreadyThere}
            value={excluding}
            onValueChange={setExcluding}
            placeholder="sh010_0010 and sh010_0020 are not offered…"
          />
        </div>
      </section>

      <section className={group} data-demo-case="more">
        <h4 className={label}>Five a page, with a load more row</h4>
        <div className={field}>
          <EntityMultiPicker
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
          <EntityMultiPicker
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
              <EntityMultiPicker client={client} entityTypes={['Asset']} value={preset} size={size} clearable />
            </div>
          ))}
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Disabled, read-only, invalid</h4>
        <div className="flex flex-col gap-2">
          <div className={field}>
            <EntityMultiPicker client={client} entityTypes={['Asset']} value={preset} disabled />
          </div>
          <div className={field}>
            <EntityMultiPicker client={client} entityTypes={['Asset']} value={preset} readOnly />
          </div>
          <div className={field}>
            <EntityMultiPicker client={client} entityTypes={['Asset']} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
