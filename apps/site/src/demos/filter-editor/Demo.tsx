import { useMemo, useState } from 'react';
import type { FilterGroup } from '@sg-widgets/core';
import { condition, group, toApi3Hash } from '@sg-widgets/core';
import { Button } from '@/components/ui/button';
import { FilterEditor, type FilterEditorSize } from '@/registry/sg/components/filter-editor';
import { createDemoContext } from '../_shared/client';
import { DemoContextProvider } from '../_shared/react';
import { VersionResults } from '../_shared/version-results';

/**
 * A tree a person would build: a status list on the multi picker, two conditions
 * reached through links, a duration and a nested any-of holding a list of values, a
 * colour and two relative windows. The duration is typed `1h 30m` or `1:30` and goes
 * out as the 90 minutes it stores.
 *
 * The link rows name the fixtures' own sequence and project, so a real site gets the
 * status row alone and the reviewer builds the rest against rows that exist.
 */
function initial(live: boolean): FilterGroup {
  const status = condition('sg_status_list', 'in', ['rev', 'vwd', 'fin', 'cmpt', 'apr']);
  if (live) return group('and', [status]);
  return group('and', [
    status,
    condition('entity.Shot.sg_sequence', 'is', { type: 'Sequence', id: 100, name: 'sh010' }),
    condition('project.Project.sg_status', 'is', 'Active'),
    condition('entity.Shot.sg_working_duration', 'greater_than', 90),
    group('or', [
      condition('code', 'contains', 'comp'),
      condition('sg_version_type', 'in', ['Type A', 'Type B']),
      condition('sg_bar_color', 'is', '253,94,99'),
      condition('sg_first_frame', 'in', [1001, 1101]),
      condition('created_at', 'in_last', [3, 'MONTH']),
      condition('entity.Shot.sg_turnover_date', 'in_next', [2, 'WEEK']),
    ]),
  ]);
}

const SIZES: FilterEditorSize[] = ['sm', 'md', 'lg'];
const section = 'flex min-w-0 flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

/** One row per control kind: a status list on the multi picker and a text on the input. */
const sizedTree = () => group('and', [condition('sg_status_list', 'in', ['rev']), condition('code', 'contains', 'sh')]);

export default function FilterEditorDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [value, setValue] = useState<FilterGroup>(() => initial(context.live));
  const hash = toApi3Hash(value);
  /** A Note, whose read-state field evaluates `is` and `is_not` and nothing else. */
  const [note, setNote] = useState<FilterGroup>(() => group('and', [condition('read_by_current_user', 'is', 'unread')]));
  const [sized, setSized] = useState<Record<FilterEditorSize, FilterGroup>>({ sm: sizedTree(), md: sizedTree(), lg: sizedTree() });

  return (
    <DemoContextProvider context={context}>
      <div className="flex min-w-0 flex-col gap-4">
        <FilterEditor
          entityType="Version"
          context={context}
          value={value}
          hidePaths={['sg_task']}
          onChange={setValue}
        />

        <section className="flex flex-col gap-2">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">api3_hash</h4>
          <pre
            data-testid="filter-json"
            className="border-border bg-muted text-foreground max-h-64 overflow-auto rounded-lg border p-3 font-mono text-xs"
          >
            {JSON.stringify(hash, null, 2)}
          </pre>
        </section>

        <VersionResults context={context} value={value} />

        <section className={section} data-demo="note">
          <h4 className={label}>Note, whose read-state field takes is and is not alone</h4>
          <FilterEditor entityType="Note" context={context} value={note} onChange={setNote} />
        </section>

        <section className={section} data-demo="sizes">
          <h4 className={label}>Sizes, beside a button of the same size</h4>
          <div className="flex min-w-0 flex-col gap-4">
            {SIZES.map((size) => (
              <div key={size} className="flex min-w-0 items-start gap-3" data-qa-widget="filter-editor" data-qa-size={size}>
                <div className="min-w-0 flex-1">
                  <FilterEditor
                    entityType="Version"
                    context={context}
                    size={size}
                    value={sized[size]}
                    onChange={(next) => setSized({ ...sized, [size]: next })}
                  />
                </div>
                <Button variant="outline" size={size === 'md' ? 'default' : size}>
                  {size}
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DemoContextProvider>
  );
}
