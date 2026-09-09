import { useEffect, useState, type KeyboardEvent } from 'react';
import type { FieldSchema, SchemaService } from '@sg-widgets/core';
import { friendlyFieldPath } from '@sg-widgets/core';
import { GripVertical, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FieldPicker } from '@/registry/sg/components/field-picker';

export type ColumnPickerSize = 'sm' | 'md' | 'lg';

/** Leaf chips follow the thumbnail/avatar ladder of `docs/design-rules.md`. */
const CHIP: Record<ColumnPickerSize, string> = {
  sm: 'h-6 text-xs',
  md: 'h-8 text-sm',
  lg: 'h-10 text-sm',
};

export interface ColumnPickerProps {
  /** Reads the schema. Build it once per app with `createSchemaService`. */
  schema: SchemaService;
  /** The type every path starts on. */
  entityType: string;
  /** The chosen dotted paths, in the order they are shown. */
  value?: string[];
  onValueChange?: (value: string[]) => void;
  /** Allow descending through entity fields. */
  deepLinks?: boolean;
  /** How many hops a path may take. */
  maxDepth?: number;
  /** Data types a field must have to be selected. Traversal ignores this. */
  dataTypes?: string | string[];
  /** A field is selectable only if it links one of these. Traversal ignores this. */
  validTypes?: string[];
  /** Full dotted paths to drop, on top of the ones already chosen. */
  exclude?: string[];
  /** Dotted prefixes to drop, along with everything beneath them. */
  hidePaths?: string[];
  /** Drop the data types the API refuses in a filter. */
  filterableOnly?: boolean;
  /** Synthetic entries offered at the root only. */
  extraFields?: { name: string; displayName?: string }[];
  /** Caller's own visibility test over the schema and the candidate's full path. */
  filter?: (field: FieldSchema, path: string) => boolean;
  /** Small inline chips, no ordering controls. */
  compact?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  size?: ColumnPickerSize;
  className?: string;
}

/**
 * An ordered list of field paths, built with the field picker.
 *
 * Every pick appends and clears the picker's search without closing it, and the
 * paths already chosen are fed back as exclusions, so a column cannot be added
 * twice. Order is the column order: drag a chip, or move the focused one with
 * Alt and an arrow key.
 */
export function ColumnPicker({
  schema,
  entityType,
  value = [],
  onValueChange,
  deepLinks = true,
  maxDepth = 2,
  dataTypes,
  validTypes,
  exclude,
  hidePaths,
  filterableOnly = false,
  extraFields,
  filter,
  compact = false,
  placeholder = 'Add a column',
  emptyLabel = 'No columns yet.',
  readOnly = false,
  disabled = false,
  invalid = false,
  size = 'md',
  className,
}: ColumnPickerProps) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<number | null>(null);

  const reorderable = !compact && !readOnly && !disabled;
  const blocked = [...(exclude ?? []), ...value];
  // Paths and synthetic names as strings, so a caller passing a fresh array literal
  // on every render does not re-run the resolution.
  const joined = value.join('\n');
  const synthetic = (extraFields ?? []).map((entry) => entry.name).join('\n');

  // One friendly label per path, resolved through the schema of every type the path
  // travels. Keyed by root type so a change of root never shows a stale label.
  useEffect(() => {
    const paths = joined ? joined.split('\n') : [];
    let live = true;
    Promise.all(
      paths.map(async (path): Promise<[string, string]> => {
        const key = `${entityType}::${path}`;
        const extra = (extraFields ?? []).find((entry) => entry.name === path);
        if (extra) return [key, extra.displayName ?? extra.name];
        try {
          return [key, friendlyFieldPath(await schema.resolvePath(entityType, path))];
        } catch {
          // A path the schema no longer holds still has to be readable.
          return [key, path];
        }
      }),
    ).then((pairs) => {
      if (live) setLabels(Object.fromEntries(pairs));
    });
    return () => {
      live = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `synthetic` stands for `extraFields`.
  }, [schema, entityType, joined, synthetic]);

  function labelOf(path: string): string | undefined {
    return labels[`${entityType}::${path}`];
  }

  function move(from: number, to: number): void {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved as string);
    onValueChange?.(next);
  }

  function onDragOver(event: React.DragEvent, index: number): void {
    if (dragging === null) return;
    event.preventDefault();
    if (dragging === index) return;
    move(dragging, index);
    setDragging(index);
  }

  function onChipKeys(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (!reorderable || !event.altKey) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, index - 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, index + 1);
    }
  }

  return (
    <div
      data-slot="column-picker"
      data-size={size}
      data-compact={compact ? 'true' : 'false'}
      className={cn('flex w-full min-w-0 flex-col gap-3', className)}
    >
      {!readOnly ? (
        <FieldPicker
          schema={schema}
          entityType={entityType}
          value=""
          onValueChange={(path) => {
            if (path && !value.includes(path)) onValueChange?.([...value, path]);
          }}
          closeOnSelect={false}
          deepLinks={deepLinks}
          maxDepth={maxDepth}
          dataTypes={dataTypes}
          validTypes={validTypes}
          exclude={blocked}
          hidePaths={hidePaths}
          filterableOnly={filterableOnly}
          extraFields={extraFields}
          filter={filter}
          placeholder={placeholder}
          clearable={false}
          disabled={disabled}
          invalid={invalid}
          size={size}
        />
      ) : null}

      {value.length === 0 ? (
        <p data-slot="column-picker-empty" className="text-muted-foreground text-sm">
          {emptyLabel}
        </p>
      ) : (
        <>
          <ol
            data-slot="column-picker-list"
            className={cn('flex min-w-0 gap-2', compact ? 'flex-wrap' : 'flex-col')}
          >
            {value.map((path, index) => (
              <li
                key={path}
                data-slot="column-picker-chip"
                data-index={index}
                data-dragging={dragging === index ? 'true' : undefined}
                onDragOver={(event) => onDragOver(event, index)}
                onDrop={() => setDragging(null)}
                className={cn(
                  'min-w-0 rounded-md transition-[opacity,transform] duration-200',
                  dragging === index && 'opacity-50',
                )}
              >
                <Badge
                  variant="secondary"
                  className={cn(
                    'w-full max-w-full min-w-0 justify-start gap-1.5 rounded-md px-2 font-normal',
                    CHIP[size],
                  )}
                >
                  {reorderable ? (
                    <button
                      type="button"
                      data-slot="column-picker-grip"
                      draggable="true"
                      aria-label={`Reorder ${labelOf(path) ?? path}, column ${index + 1} of ${value.length}`}
                      title="Drag, or Alt with an arrow key, to reorder"
                      onDragStart={() => setDragging(index)}
                      onDragEnd={() => setDragging(null)}
                      onKeyDown={(event) => onChipKeys(event, index)}
                      className="focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 cursor-grab rounded-sm opacity-50 outline-none transition-opacity duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2"
                    >
                      <GripVertical aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : null}
                  {labelOf(path) === undefined ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    <span className="truncate" title={path}>
                      {labelOf(path)}
                    </span>
                  )}
                  {!readOnly && !disabled ? (
                    <button
                      type="button"
                      data-slot="column-picker-remove"
                      aria-label={`Remove ${labelOf(path) ?? path}`}
                      onClick={() => onValueChange?.(value.filter((_, i) => i !== index))}
                      className="hover:bg-destructive/15 hover:text-destructive focus-visible:ring-ring focus-visible:ring-offset-background ml-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
                    >
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : null}
                </Badge>
              </li>
            ))}
          </ol>
          <p data-slot="column-picker-count" className="text-muted-foreground text-xs">
            {value.length} {value.length === 1 ? 'column' : 'columns'}
            {reorderable ? ' · drag a chip, or Alt with an arrow key, to reorder' : ''}
          </p>
        </>
      )}
    </div>
  );
}
