import { useMemo, useState } from 'react';
import type { EntityRef } from 'sg-widgets-core';
import { ProjectMultiPicker } from '@/registry/sg/components/project-multi-picker';
import { createDemoContext } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
// One control per row, full width of the pane, its caption on the line above.
const field = 'flex w-full flex-col gap-2';
const stack = 'flex flex-col gap-4';
const caption = 'text-muted-foreground text-xs';
/** At most 20rem, so the fit has something to cut against. */
const narrow = 'max-w-80';

const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

export default function ProjectMultiPickerDemo() {
  const context = useMemo(() => createDemoContext(), []);
  // The names are the mock's. A live site holds its own projects, so the picker is
  // handed the one the page is scoped to and resolves its name.
  const preset: EntityRef[] = context.live
    ? [{ type: 'Project', id: context.projectId }]
    : [
        { type: 'Project', id: 70, name: 'Blue Moon Rising' },
        { type: 'Project', id: 71, name: 'Harbour Lights' },
        { type: 'Project', id: 72, name: 'Night Ferry' },
      ];

  const [several, setSeveral] = useState<EntityRef[]>([]);
  const [archived, setArchived] = useState<EntityRef[]>([]);
  // Bare references: type and id, no name. Resolved on mount.
  const [bare, setBare] = useState<EntityRef[]>([{ type: 'Project', id: context.projectFor(71) }]);
  /** One value per summary demo, so every control on the page takes an edit. */
  const [shown, setShown] = useState<Record<string, EntityRef[]>>({});
  const shownAt = (at: string) => shown[at] ?? preset;
  const showAt = (at: string, next: EntityRef[]) => setShown((held) => ({ ...held, [at]: next }));

  return (
    <div className="flex flex-col gap-3">
      <section className={group} data-demo-case="multi">
        <h4 className={label}>Several projects</h4>
        <div className={field}>
          <span className={caption}>Several projects at once</span>
          <ProjectMultiPicker context={context} value={several} onValueChange={setSeveral} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="tokens">
        <h4 className={label}>A token field: Backspace walks the chips</h4>
        <div className={field}>
          <span className={caption}>The projects already chosen, as chips</span>
          <ProjectMultiPicker
            context={context}
            summary="chips"
            value={shownAt('tokens')}
            onValueChange={(next) => showAt('tokens', next)}
            clearable
          />
        </div>
      </section>

      <section className={group} data-demo-case="archived">
        <h4 className={label}>Archived projects included</h4>
        <div className={field}>
          <span className={caption}>Archived projects included</span>
          <ProjectMultiPicker context={context} includeArchived value={archived} onValueChange={setArchived} />
        </div>
      </section>

      <section className={group} data-demo-case="hydrate">
        <h4 className={label}>Bare references, resolved on mount</h4>
        <div className={field}>
          <span className={caption}>Types and ids in, names resolved on mount</span>
          <ProjectMultiPicker context={context} value={bare} onValueChange={setBare} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="summary">
        <h4 className={label}>What the control shows for the selection, wide and narrow</h4>
        <div className={stack}>
          {SUMMARIES.map((summary) => (
            <div className={stack} key={summary}>
              <div className={field} data-demo-summary={summary}>
                <span className={caption}>{summary}, full width</span>
                <ProjectMultiPicker
                  context={context}
                  value={shownAt(summary)}
                  onValueChange={(next) => showAt(summary, next)}
                  summary={summary}
                  clearable={false}
                />
              </div>
              <div className={field} data-demo-summary={`${summary}-narrow`}>
                <span className={caption}>{summary}, at most 20rem</span>
                <div className={narrow}>
                  <ProjectMultiPicker
                    context={context}
                    value={shownAt(`${summary}-narrow`)}
                    onValueChange={(next) => showAt(`${summary}-narrow`, next)}
                    summary={summary}
                    clearable={false}
                  />
                </div>
              </div>
            </div>
          ))}
          <div className={field} data-demo-summary="max">
            <span className={caption}>chips, two at most</span>
            <ProjectMultiPicker
              context={context}
              value={shownAt('max')}
              onValueChange={(next) => showAt('max', next)}
              summary="chips"
              max={2}
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Sizes, then disabled, read-only, invalid</h4>
        <div className={stack}>
          {SIZES.map((size) => (
            <div className={field} key={size}>
              <span className={caption}>{size}</span>
              <ProjectMultiPicker context={context} value={preset} size={size} clearable />
            </div>
          ))}
          <div className={field}>
            <span className={caption}>Disabled</span>
            <ProjectMultiPicker context={context} value={preset} disabled />
          </div>
          <div className={field}>
            <span className={caption}>Read-only</span>
            <ProjectMultiPicker context={context} value={preset} readonly />
          </div>
          <div className={field}>
            <span className={caption}>Invalid</span>
            <ProjectMultiPicker context={context} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
