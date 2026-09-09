import { useState, type ReactNode } from 'react';
import type { FilterGroup, SchemaService, SgClient } from '@sg-widgets/core';
import { countActiveConditions, emptyFilter, isEmptyFilter } from '@sg-widgets/core';
import { ListFilterIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  FilterEditor,
  type FieldChooserArgs,
  type ValueEditorArgs,
} from '@/registry/sg/components/filter-editor';

export interface FilterDialogProps {
  entityType: string;
  client: SgClient;
  schema?: SchemaService;
  value: FilterGroup;
  hidePaths?: string[];
  disabled?: boolean;
  /** Replaces both button labels. Otherwise Add filters, then Edit filters. */
  label?: string;
  title?: string;
  onChange?: (value: FilterGroup) => void;
  fieldChooser?: (args: FieldChooserArgs) => ReactNode;
  valueEditor?: (args: ValueEditorArgs) => ReactNode;
  entityEditor?: (args: ValueEditorArgs) => ReactNode;
  className?: string;
}

/**
 * The launcher for the filter editor.
 *
 * Empty, it is one Add filters button. With filters applied it is an Edit filters
 * button carrying the count, plus a control that clears them without opening
 * anything. Edits inside the dialog are staged: only Apply emits, Cancel drops
 * them, and Clear all emits an empty filter.
 */
export function FilterDialog({
  entityType,
  client,
  schema,
  value = emptyFilter(),
  hidePaths = [],
  disabled = false,
  label,
  title = 'Filters',
  onChange,
  fieldChooser,
  valueEditor,
  entityEditor,
  className,
}: FilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterGroup>(value);
  const active = countActiveConditions(value);

  function apply() {
    // A tree of blank rows is not a filter; it applies as no filter at all.
    onChange?.(isEmptyFilter(draft) ? emptyFilter() : draft);
    setOpen(false);
  }

  function clearAll() {
    onChange?.(emptyFilter());
    setOpen(false);
  }

  return (
    <div className={cn('inline-flex items-center gap-2', className)} data-slot="filter-dialog">
      {/* The draft starts from the applied value every time the dialog opens, so a cancelled edit leaves nothing behind. */}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(value);
          setOpen(next);
        }}
      >
        <DialogTrigger
          disabled={disabled}
          data-slot="filter-launch"
          className="border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
        >
          {active > 0 ? (
            <>
              <PencilIcon className="size-4" />
              {label ?? 'Edit filters'}
              <Badge variant="secondary" data-slot="filter-count">
                {active}
              </Badge>
            </>
          ) : (
            <>
              <ListFilterIcon className="size-4" />
              {label ?? 'Add filters'}
            </>
          )}
        </DialogTrigger>
        {/* A condition row wants room: the dialog takes the viewport up to 64rem. */}
        <DialogContent className="w-[min(96vw,64rem)] sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Rows match on {entityType}. Nothing applies until you press Apply.
            </DialogDescription>
          </DialogHeader>
          <FilterEditor
            entityType={entityType}
            client={client}
            schema={schema}
            hidePaths={hidePaths}
            value={draft}
            onChange={setDraft}
            fieldChooser={fieldChooser}
            valueEditor={valueEditor}
            entityEditor={entityEditor}
          />
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" data-slot="filter-clear-all" onClick={clearAll}>
              Clear all
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" data-slot="filter-cancel" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button data-slot="filter-apply" onClick={apply}>
                Apply
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {active > 0 ? (
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label="Clear filters"
          data-slot="filter-clear"
          onClick={() => onChange?.(emptyFilter())}
        >
          <Trash2Icon />
        </Button>
      ) : null}
    </div>
  );
}
