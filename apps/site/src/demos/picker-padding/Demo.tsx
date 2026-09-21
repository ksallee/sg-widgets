/**
 * Every picker control, empty beside filled, at the three sizes.
 *
 * Each cell carries `data-qa-picker`, `data-qa-case` and `data-qa-size`, so a drive
 * script reads the pair without knowing a widget's markup. The values are fixed: this
 * harness is read, not operated.
 */
import { Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { EntityRef } from 'sg-widgets-core';
import { ContextSelector, type WorkContext } from '@/registry/sg/components/context-selector';
import { EntityMultiPicker } from '@/registry/sg/components/entity-multi-picker';
import { EntityPicker } from '@/registry/sg/components/entity-picker';
import { EntityTypeMultiPicker } from '@/registry/sg/components/entity-type-multi-picker';
import { EntityTypePicker } from '@/registry/sg/components/entity-type-picker';
import { FieldPicker } from '@/registry/sg/components/field-picker';
import { ProjectMultiPicker } from '@/registry/sg/components/project-multi-picker';
import { ProjectPicker } from '@/registry/sg/components/project-picker';
import { StatusMultiPicker } from '@/registry/sg/components/status-multi-picker';
import { StatusPicker } from '@/registry/sg/components/status-picker';
import { UserMultiPicker } from '@/registry/sg/components/user-multi-picker';
import { UserPicker } from '@/registry/sg/components/user-picker';
import { createDemoContext } from '../_shared/client';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Size[] = ['md', 'sm', 'lg'];

const ASSET: EntityRef = { type: 'Asset', id: 1226, name: 'charAda' };
const PERSON: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };

const section = 'flex flex-col gap-3';
const heading = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const columns = 'grid grid-cols-2 gap-4';
const stack = 'flex min-w-0 flex-col gap-3';
const cell = 'flex min-w-0 flex-col gap-1';
const caption = 'text-muted-foreground text-xs';

export default function PickerPaddingDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const projectId = context.projectId;
  const project: EntityRef = context.live
    ? { type: 'Project', id: projectId }
    : { type: 'Project', id: projectId, name: 'Blue Moon Rising' };

  function pickers(size: Size, filled: boolean): [string, ReactNode][] {
    const work: WorkContext = filled
      ? { project, entity: ASSET, task: null }
      : { project: null, entity: null, task: null };
    return [
      ['entity-picker', <EntityPicker context={context} entityTypes={['Asset']} size={size} value={filled ? ASSET : null} />],
      ['entity-multi-picker', <EntityMultiPicker context={context} entityTypes={['Asset']} size={size} value={filled ? [ASSET] : []} />],
      ['user-picker', <UserPicker context={context} size={size} value={filled ? PERSON : null} />],
      ['user-multi-picker', <UserMultiPicker context={context} size={size} value={filled ? [PERSON] : []} />],
      ['project-picker', <ProjectPicker context={context} size={size} value={filled ? project : null} />],
      ['project-multi-picker', <ProjectMultiPicker context={context} size={size} value={filled ? [project] : []} />],
      ['status-picker', <StatusPicker context={context} entityType="Version" projectId={projectId} size={size} value={filled ? 'ip' : null} />],
      ['status-multi-picker', <StatusMultiPicker context={context} entityType="Version" projectId={projectId} size={size} value={filled ? ['ip', 'apr'] : []} />],
      ['entity-type-picker', <EntityTypePicker context={context} size={size} value={filled ? 'Shot' : null} />],
      ['entity-type-multi-picker', <EntityTypeMultiPicker context={context} size={size} value={filled ? ['Shot', 'Asset'] : []} />],
      ['field-picker', <FieldPicker context={context} entityType="Version" size={size} value={filled ? 'code' : ''} />],
      ['context-selector', <ContextSelector context={context} size={size} workContext={work} currentUser={PERSON} />],
    ];
  }

  function column(size: Size, filled: boolean) {
    return (
      <div className={stack}>
        <span className={caption}>{filled ? 'Filled' : 'Empty'}</span>
        {pickers(size, filled).map(([name, node]) => (
          <div
            key={name}
            className={cell}
            data-qa-picker={name}
            data-qa-case={filled ? 'filled' : 'empty'}
            data-qa-size={size}
          >
            <span className={caption}>{name}</span>
            {node}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {SIZES.map((size) => (
        <Fragment key={size}>
          <section className={section}>
            <h4 className={heading}>Size {size}</h4>
            <div className={columns}>
              {column(size, false)}
              {column(size, true)}
            </div>
          </section>
        </Fragment>
      ))}
    </div>
  );
}
