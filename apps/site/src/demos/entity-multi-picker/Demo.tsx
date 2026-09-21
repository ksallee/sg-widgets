import { Fragment, useState } from 'react';
import type { EntityRef } from 'sg-widgets-core';
import { EntityMultiPicker } from '@/registry/sg/components/entity-multi-picker';
import { createDemoClient, getDemoContext } from '../_shared/client';

const group = 'flex flex-col gap-3';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
/** One control per row, at the pane's full width, with its caption above it. */
const stack = 'flex flex-col gap-4';
const field = 'flex w-full flex-col gap-2';
const caption = 'text-muted-foreground text-xs';
/** At most 20rem, so the fit has something to cut against. */
const narrow = 'max-w-80';
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
/** Five, so `ellipsis` has something to count and `max` something to cut. */
const five: EntityRef[] = [
  ...preset,
  { type: 'Asset', id: 1228, name: 'propLantern' },
  { type: 'Asset', id: 1229, name: 'propCrate' },
  { type: 'Asset', id: 1230, name: 'envForest' },
];
const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

export default function EntityMultiPickerDemo() {
  const context = getDemoContext();
  // Its own context, so arming a failure cannot land in another demo on the page.
  const [failing] = useState(() => createDemoClient());

  const [shots, setShots] = useState<EntityRef[]>([]);
  const [withStatus, setWithStatus] = useState<EntityRef[]>([]);
  const [anatomy, setAnatomy] = useState<EntityRef[]>([]);
  const [anything, setAnything] = useState<EntityRef[]>([]);
  const [custom, setCustom] = useState<EntityRef[]>([]);
  // Bare references: type and id, no name. Resolved on mount, one read per type.
  const [bare, setBare] = useState<EntityRef[]>([
    { type: 'Shot', id: 866 },
    { type: 'Asset', id: 1226 },
  ]);
  const [excluding, setExcluding] = useState<EntityRef[]>([]);
  /** A token field with chips already in it, for the keyboard. */
  const [tokens, setTokens] = useState<EntityRef[]>([
    { type: 'Asset', id: 1226, name: 'charAda' },
    { type: 'Asset', id: 1227, name: 'charBruno' },
    { type: 'Asset', id: 1228, name: 'propLantern' },
  ]);
  const [paged, setPaged] = useState<EntityRef[]>([]);
  const [failed, setFailed] = useState<EntityRef[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <section className={group} data-demo-case="multi">
        <h4 className={label}>Several shots</h4>
        <div className={field}>
          <EntityMultiPicker
            context={context}
            entityTypes={['Shot']}
            value={shots}
            onValueChange={setShots}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="tokens">
        <h4 className={label}>A token field: Backspace walks the chips</h4>
        <div className={field}>
          <EntityMultiPicker
            context={context}
            entityTypes={['Asset']}
            summary="chips"
            value={tokens}
            onValueChange={setTokens}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="status-secondary">
        <h4 className={label}>Status as secondary</h4>
        <div className={field}>
          <EntityMultiPicker
            context={context}
            entityTypes={['Shot']}
            secondaryField="sg_status_list"
            value={withStatus}
            onValueChange={setWithStatus}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="anatomy">
        <h4 className={label}>Everything on a row: thumbnail, sub-label, secondary and the code beside the name</h4>
        <div className={field}>
          <EntityMultiPicker
            context={context}
            entityTypes={['Version']}
            subLabelField="sg_status_list"
            secondaryField="id"
            showCode
            value={anatomy}
            onValueChange={setAnatomy}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="multi-type">
        <h4 className={label}>Three types at once, the type on the right</h4>
        <div className={field}>
          <EntityMultiPicker
            context={context}
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
            context={context}
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
            context={context}
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
            context={context}
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
            context={context}
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
            context={failing.context}
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

      <section className={group} data-demo-case="summary">
        <h4 className={label}>What the control shows for five selected, wide and narrow</h4>
        <div className={stack}>
          {SUMMARIES.map((summary) => (
            <Fragment key={summary}>
              <div className={field} data-demo-summary={summary}>
                <span className={caption}>{summary}, full width</span>
                <EntityMultiPicker
                  context={context}
                  entityTypes={['Asset']}
                  value={five}
                  summary={summary}
                  clearable={false}
                />
              </div>
              <div className={field} data-demo-summary={`${summary}-narrow`}>
                <span className={caption}>{summary}, at most 20rem</span>
                <div className={narrow}>
                  <EntityMultiPicker
                    context={context}
                    entityTypes={['Asset']}
                    value={five}
                    summary={summary}
                    clearable={false}
                  />
                </div>
              </div>
            </Fragment>
          ))}
          <div className={field} data-demo-summary="max">
            <span className={caption}>chips, two at most</span>
            <EntityMultiPicker
              context={context}
              entityTypes={['Asset']}
              value={five}
              summary="chips"
              max={2}
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group} data-demo-case="sizes">
        <h4 className={label}>Sizes</h4>
        <div className={stack}>
          {SIZES.map((size) => (
            <div className={field} key={size}>
              <span className={caption}>{size}</span>
              <EntityMultiPicker context={context} entityTypes={['Asset']} value={preset} size={size} clearable />
            </div>
          ))}
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Disabled, read-only, invalid</h4>
        <div className={stack}>
          <div className={field}>
            <span className={caption}>Disabled</span>
            <EntityMultiPicker context={context} entityTypes={['Asset']} value={preset} disabled />
          </div>
          <div className={field}>
            <span className={caption}>Read-only</span>
            <EntityMultiPicker context={context} entityTypes={['Asset']} value={preset} readonly />
          </div>
          <div className={field}>
            <span className={caption}>Invalid</span>
            <EntityMultiPicker context={context} entityTypes={['Asset']} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
