import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { SgContext, SortKey } from '@sg-widgets/core';
import { friendlyFieldPath, isSortable, toSortString } from '@sg-widgets/core';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  XIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { FieldPicker } from '@/registry/sg/components/field-picker';
import { useSortable } from '@/registry/sg/components/sortable';

export type SortPickerSize = 'sm' | 'md' | 'lg';

/** Controls follow the input ladder of `docs/design-rules.md`. */
const BOX: Record<SortPickerSize, string> = { sm: 'h-8 px-2', md: 'h-9 px-3', lg: 'h-10 px-3' };
const GLYPH: Record<SortPickerSize, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' };

export interface SortPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  entityType: string;
  /** The widget context. Every read goes through it, so widgets on a page share one cache. */
  context: SgContext;
  value: SortKey[];
  /** Paths to keep out of the field list, each hiding itself and everything under it. */
  hidePaths?: string[];
  size?: SortPickerSize;
  disabled?: boolean;
  /** Both the keys and the `sort` string they serialise to. */
  onChange?: (value: SortKey[], sort: string) => void;
  /** Whether the popover is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * The `sort` a query carries, as an ordered list.
 *
 * Each key is a field and a direction; the list serialises to the comma-joined
 * string `_search` takes, a leading `-` marking a descending key
 * (026_result_order). Order is meaningful: the first key wins, and id ascending
 * breaks every remaining tie whether or not it is in the list.
 *
 * A key may be a dotted path: `entity.Shot.code` sorts, and so does
 * `project.Project.name` under `-` (026_result_order), so the field picker descends
 * through links. An unsortable or unknown field is a silent 200 no-op with the rows
 * in default order, so only types that sort are offered.
 */
export function SortPicker({
  entityType,
  context,
  value = [],
  hidePaths = [],
  size = 'md',
  disabled = false,
  onChange,
  open: openProp,
  onOpenChange,
  className,
  ref,
  ...rest
}: SortPickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  /** The friendly label of every path in the list, resolved once and kept. */
  const [labels, setLabels] = useState<Record<string, string>>({});
  const resolving = useRef(new Map<string, Promise<string>>());

  const resolveLabel = useCallback(
    (path: string) => {
      const at = `${entityType}|${path}`;
      if (resolving.current.has(at)) return;
      const job = context.schema.resolvePath(entityType, path).then(friendlyFieldPath, () => path);
      resolving.current.set(at, job);
      void job.then((label) => {
        setLabels((held) => ({ ...held, [at]: label }));
      });
    },
    [context.schema, entityType],
  );

  useEffect(() => {
    for (const key of value) resolveLabel(key.field);
  }, [value, resolveLabel]);

  const chosen = value.map((k) => k.field);
  const nameOf = (field: string): string => labels[`${entityType}|${field}`] ?? field;

  const label = value.length === 0 ? 'Sort' : value.map((k) => nameOf(k.field)).join(', ');
  const commit = (next: SortKey[]) => onChange?.(next, toSortString(next));

  function add(path: string) {
    if (path) commit([...value, { field: path, direction: 'asc' }]);
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [key] = next.splice(index, 1);
    next.splice(to, 0, key as SortKey);
    commit(next);
  }

  const { ref: sortableRef, dragging, announcement } = useSortable<HTMLDivElement>({
    ids: chosen,
    onOrderChange: (order) =>
      commit(order.map((field) => value.find((k) => k.field === field) as SortKey)),
    label: nameOf,
    disabled,
  });

  function onKeyKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    // The sortable owns the arrow keys while it carries a row.
    if (disabled || dragging !== null || !event.altKey) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, -1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, 1);
    }
  }

  return (
    <div
      ref={ref}
      data-slot="sort-picker"
      className={cn('inline-flex min-w-0 items-center', className)}
      {...rest}
    >
      <Popover open={open} onOpenChange={(next) => setOpen(disabled ? false : next)}>
        <PopoverTrigger
          disabled={disabled}
          data-slot="sort-trigger"
          data-size={size}
          className={cn(
            'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex min-w-0 items-center gap-1.5 rounded-lg border text-sm font-medium outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
            BOX[size],
          )}
        >
          <ArrowUpDownIcon className={cn('shrink-0', GLYPH[size])} />
          <span className="min-w-0 truncate" title={label}>
            {label}
          </span>
          {value.length > 1 ? (
            <Badge variant="secondary" className="shrink-0" data-slot="sort-count">
              {value.length}
            </Badge>
          ) : null}
        </PopoverTrigger>
        <PopoverContent className="flex w-96 flex-col gap-3 p-3" align="start">
          <div className="flex min-w-0 flex-col gap-2" data-slot="sort-keys" ref={sortableRef}>
            {value.map((key, i) => (
              <div
                key={key.field}
                className={cn(
                  'bg-popover flex min-w-0 items-center gap-2 rounded-md',
                  'data-[dragging]:z-10 data-[dragging]:opacity-90 data-[dragging]:shadow-md',
                  'data-[drop-target]:bg-accent/40',
                )}
                data-slot="sort-key"
                data-sortable-id={key.field}
                data-field={key.field}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  data-slot="sort-grip"
                  data-sortable-handle="true"
                  onKeyDown={(event) => onKeyKeys(event, i)}
                  aria-label={`Reorder ${nameOf(key.field)}`}
                  title="Drag to reorder, or press Space and use the arrow keys"
                  className="cursor-grab touch-none active:cursor-grabbing"
                >
                  <GripVerticalIcon />
                </Button>
                <span className="min-w-0 flex-1 truncate text-sm" title={key.field}>
                  {nameOf(key.field)}
                </span>
                <ToggleGroup
                  size="sm"
                  variant="outline"
                  value={[key.direction]}
                  data-slot="sort-direction"
                  onValueChange={(next) => {
                    const picked = next[0];
                    if (picked) {
                      commit(value.map((k, j) => (j === i ? { ...k, direction: picked as SortKey['direction'] } : k)));
                    }
                  }}
                >
                  <ToggleGroupItem value="asc" aria-label="Ascending">
                    <ArrowUpIcon />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="desc" aria-label="Descending">
                    <ArrowDownIcon />
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove"
                  data-slot="sort-remove"
                  onClick={() => commit(value.filter((_, j) => j !== i))}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            {value.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No sort. Rows come back id ascending.
              </p>
            ) : null}
          </div>
          <div
            data-slot="sort-live-region"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {announcement}
          </div>
          <Separator />
          <FieldPicker
            context={context}
            entityType={entityType}
            hidePaths={hidePaths}
            disabled={disabled}
            size={size}
            value=""
            deepLinks
            clearable={false}
            exclude={chosen}
            filter={(field) => isSortable(field.dataType)}
            placeholder="Add a field"
            searchPlaceholder="Add a field…"
            emptyLabel="No field left to sort on"
            onValueChange={add}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
