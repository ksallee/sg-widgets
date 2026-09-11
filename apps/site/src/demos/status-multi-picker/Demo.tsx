import { Fragment, useMemo, useState } from 'react';
import { StatusMultiPicker } from '@/registry/sg/components/status-multi-picker';
import { createDemoContext } from '../_shared/client';

/** An invented pipeline stage per code, for the row secondary a caller supplies. */
const STAGE: Record<string, string> = { ip: 'Animation', rev: 'Review', fin: 'Delivery' };
const stageOf = (option: { code: string }) => STAGE[option.code] ?? '';

const group = 'flex flex-col gap-3';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
/** One control per row, at the pane's full width, with its caption above it. */
const stack = 'flex flex-col gap-4';
const field = 'flex w-full flex-col gap-2';
const caption = 'text-muted-foreground text-xs';
/** At most 20rem, so the fit has something to cut against. */
const narrow = 'max-w-80';
const readout = 'text-muted-foreground font-mono text-xs tabular-nums';

const MODES = ['chips', 'ellipsis', 'count'] as const;
const BADGES = ['both', 'icon', 'text'] as const;
const TWO = ['ip', 'apr'];
const FIVE = ['ip', 'apr', 'rev', 'fin', 'vwd'];

export default function StatusMultiPickerDemo() {
  // Live mode has one project, the toolbar's; the mock has 70 and 71.
  const context = useMemo(() => createDemoContext(), []);
  const projectId = context.projectId;
  const otherProjectId = context.projectFor(71);
  const [inProjectA, setInProjectA] = useState<string[]>(['ip', 'apr']);
  const [inProjectB, setInProjectB] = useState<string[]>(['pndad']);
  const [shared, setShared] = useState<string[]>([]);
  const [project, setProject] = useState<string[]>(['Active', 'Bidding']);
  const [unknown, setUnknown] = useState<string[]>(['zz_retired', 'rev']);
  /** One value per summary demo, so every control on the page takes an edit. */
  const [shown, setShown] = useState<Record<string, string[]>>({});
  const shownAt = (at: string) => shown[at] ?? FIVE;
  const showAt = (at: string, next: string[]) => setShown({ ...shown, [at]: next });

  return (
    <div className="flex flex-col gap-4">
      <section className={group}>
        <h4 className={label}>
          {projectId === otherProjectId
            ? `Version, in project ${projectId}`
            : `Version, in project ${projectId} and in project ${otherProjectId}`}
        </h4>
        <div className={stack}>
          <div className={field} data-demo="p70">
            <span className={caption}>Project {projectId}</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={inProjectA}
              onValueChange={setInProjectA}
            />
          </div>
          <div className={field} data-demo="p71">
            <span className={caption}>Project {otherProjectId}</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={otherProjectId}
              value={inProjectB}
              onValueChange={setInProjectB}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>The statuses both projects offer</h4>
        <div className={stack}>
          <div className={field} data-demo="both">
            <span className={caption}>The intersection of both projects&apos; codes</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectIds={[projectId, otherProjectId]}
              value={shared}
              onValueChange={setShared}
            />
            <span className={readout}>{shared.join(', ') || '—'}</span>
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Project, whose status field is a plain list with no icons</h4>
        <div className={stack}>
          <div className={field} data-demo="project">
            <span className={caption}>Project&apos;s own status field</span>
            <StatusMultiPicker
              context={context}
              entityType="Project"
              value={project}
              onValueChange={setProject}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>
          A code the field does not carry, rows without the code, and a secondary of the caller's own
        </h4>
        <div className={stack}>
          <div className={field} data-demo="unknown">
            <span className={caption}>A code the field does not carry</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={unknown}
              onValueChange={setUnknown}
            />
          </div>
          <div className={field} data-demo="no-code">
            <span className={caption}>Rows with the label alone</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={['ip', 'fin']}
              showCode={false}
              clearable={false}
            />
          </div>
          <div className={field} data-demo="own-secondary">
            <span className={caption}>A secondary of the caller's own, in place of the code</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={['ip', 'fin']}
              secondary={stageOf}
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>What the closed trigger shows for five selected, wide and narrow</h4>
        <div className={stack}>
          {MODES.map((mode) => (
            <Fragment key={mode}>
              <div className={field} data-demo={`summary-${mode}-5`}>
                <span className={caption}>{mode}, full width</span>
                <StatusMultiPicker
                  context={context}
                  entityType="Version"
                  projectId={projectId}
                  value={shownAt(`${mode}-5`)}
                  onValueChange={(next) => showAt(`${mode}-5`, next)}
                  summary={mode}
                  clearable={false}
                />
              </div>
              <div className={field} data-demo={`summary-${mode}-narrow`}>
                <span className={caption}>{mode}, at most 20rem</span>
                <div className={narrow}>
                  <StatusMultiPicker
                    context={context}
                    entityType="Version"
                    projectId={projectId}
                    value={shownAt(`${mode}-narrow`)}
                    onValueChange={(next) => showAt(`${mode}-narrow`, next)}
                    summary={mode}
                    clearable={false}
                  />
                </div>
              </div>
            </Fragment>
          ))}
          <div className={field} data-demo="summary-chips-2">
            <span className={caption}>chips, two selected</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={TWO}
              summary="chips"
              clearable={false}
            />
          </div>
          <div className={field} data-demo="badge-text-2">
            <span className={caption}>text badges, two selected</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={TWO}
              summary="chips"
              badge="text"
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>What one badge is drawn as, for five selected</h4>
        <div className={stack}>
          {BADGES.map((badge) => (
            <div className={field} key={badge} data-demo={`badge-${badge}-5`}>
              <span className={caption}>{badge}</span>
              <StatusMultiPicker
                context={context}
                entityType="Version"
                projectId={projectId}
                value={FIVE}
                summary="chips"
                badge={badge}
                clearable={false}
              />
            </div>
          ))}
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Two selected, one badge and a &quot;+1&quot;</h4>
        <div className={stack}>
          <div className={field} data-demo="max-one">
            <span className={caption}>One badge at most, whatever the room</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={TWO}
              max={1}
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Disabled, read-only, invalid</h4>
        <div className={stack}>
          <div className={field}>
            <span className={caption}>Disabled</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={['apr', 'fin']}
              disabled
            />
          </div>
          <div className={field}>
            <span className={caption}>Read-only</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={['apr']}
              readonly
            />
          </div>
          <div className={field}>
            <span className={caption}>Invalid</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={['apr', 'fin']}
              invalid
            />
          </div>
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>Sizes</h4>
        <div className={stack}>
          <div className={field}>
            <span className={caption}>sm</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={['rev']}
              size="sm"
            />
          </div>
          <div className={field}>
            <span className={caption}>md</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={['rev']}
              size="md"
            />
          </div>
          <div className={field}>
            <span className={caption}>lg</span>
            <StatusMultiPicker
              context={context}
              entityType="Version"
              projectId={projectId}
              value={['rev']}
              size="lg"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
