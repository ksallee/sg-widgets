import { useMemo, useState } from 'react';
import type { EntityRef, TreeNode } from 'sg-widgets-core';
import { Button } from '@/components/ui/button';
import { CONTROL_BUTTON, type ControlSize } from '@/registry/sg/components/control-classes';
import { EntityTree } from '@/registry/sg/components/entity-tree';
import { createDemoClient, createDemoContext } from '../_shared/client';
import { DemoContextProvider } from '../_shared/react';

const SIZES: ControlSize[] = ['sm', 'md', 'lg'];
const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const toggle =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-sm shadow-xs ' +
  'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export default function EntityTreeDemo() {
  const context = useMemo(() => createDemoContext(), []);
  /** Its own fixtures, with one asset's thumbnail field reading empty rather than absent. */
  const blanked = useMemo(() => {
    const own = createDemoClient();
    const asset = own.mock
      .rowsOf('Asset')
      .find((row) => (row['project'] as { id: number } | null)?.id === own.context.projectId);
    if (asset) (asset as Record<string, unknown>)['image'] = '';
    return own.context;
  }, []);
  const [picked, setPicked] = useState<TreeNode | null>(null);
  const [checked, setChecked] = useState<EntityRef[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

  const rootPath = `/Project/${context.projectId}`;
  const seedPath = context.live ? null : `${rootPath}/Shot/sg_sequence/Sequence/100/id/862`;
  /** The project whose shots sit under no sequence at all. */
  const looseRoot = `/Project/${context.projectFor(72)}`;
  const searchPlaceholder = context.live ? 'Search' : 'Search, e.g. sh020_0030';

  return (
    <DemoContextProvider context={context}>
      <div className="flex w-full min-w-0 flex-col gap-4">
        <section className={group}>
          <h4 className={label}>A project, seeded open, searchable, with checkboxes</h4>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={toggle}
              data-testid="open-assets"
              onClick={() =>
                setExpanded((was) => (was.includes(`${rootPath}/Asset`) ? was : [...was, `${rootPath}/Asset`]))
              }
            >
              Open Assets
            </button>
            <span className="text-muted-foreground text-xs tabular-nums" data-testid="expanded-count">
              {expanded.length} open
            </span>
          </div>
          <EntityTree
            context={context}
            rootPath={rootPath}
            seedPath={seedPath}
            checkable
            searchable
            searchPlaceholder={searchPlaceholder}
            showCode
            expanded={expanded}
            onExpandedChange={setExpanded}
            onSelect={setPicked}
            onCheckedChange={setChecked}
          />
          <p className="text-muted-foreground text-xs">
            <span data-testid="picked">{picked ? picked.label : 'nothing selected'}</span>
            <span className="tabular-nums" data-testid="checked-count">
              , {checked.length} checked
            </span>
          </p>
        </section>

        <section className={group}>
          <h4 className={label}>A project whose shots sit under no sequence</h4>
          <EntityTree context={context} rootPath={looseRoot} maxHeight="12rem" data-testid="loose-tree" />
        </section>

        <section className={group}>
          <h4 className={label}>The same tree with thumbnails</h4>
          <EntityTree
            context={context}
            rootPath={rootPath}
            thumbnail="image"
            subLabelField="description"
            maxHeight="16rem"
            data-testid="thumbnail-tree"
          />
        </section>

        <section className={group}>
          <h4 className={label}>A row whose thumbnail field reads empty</h4>
          <EntityTree
            context={blanked}
            rootPath={`/Project/${blanked.projectId}`}
            thumbnail="image"
            maxHeight="12rem"
            data-testid="empty-thumb-tree"
          />
        </section>

        <section className={group}>
          <h4 className={label}>Sizes, each beside a button of the same step</h4>
          {SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-start gap-3" data-demo={`size-${size}`}>
              <div className="w-72" data-qa-widget="entity-tree" data-qa-size={size}>
                <EntityTree context={context} rootPath={rootPath} searchable size={size} maxHeight="8rem" />
              </div>
              <Button variant="outline" size={CONTROL_BUTTON[size]}>
                Button
              </Button>
            </div>
          ))}
        </section>
      </div>
    </DemoContextProvider>
  );
}
