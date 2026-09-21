import { useState, type ReactNode } from 'react';
import type { FilterGroup, SgContext } from 'sg-widgets-core';
import { countActiveConditions, emptyFilter, isEmptyFilter } from 'sg-widgets-core';
import { ListFilterIcon, PencilIcon, Trash2Icon } from 'lucide-react';
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
import { CONTROL_BOX, CONTROL_GLYPH, type ControlSize } from '@/registry/sg/components/control-classes';
import { CHIP_BOX, CHIP_PAD, type ChipSize } from '@/registry/sg/components/leaf-classes';
import {
  FilterEditor,
  type FieldChooserArgs,
  type ValueEditorArgs,
} from '@/registry/sg/components/filter-editor';

export type FilterDialogSize = ControlSize;

/** The icon-button step beside a control of each height. */
const ICON: Record<FilterDialogSize, 'icon-sm' | 'icon' | 'icon-lg'> = {
  sm: 'icon-sm',
  md: 'icon',
  lg: 'icon-lg',
};
/** The count beside the label is a chip, so it takes the step under the control. */
const COUNT: Record<FilterDialogSize, ChipSize> = { sm: 'xs', md: 'sm', lg: 'md' };
/** A text chip wears the entity chip's surface, as a picker's code chip does. */
const COUNT_CHIP =
  'bg-secondary text-secondary-foreground inline-flex shrink-0 items-center rounded-md border tabular-nums';

export interface FilterDialogProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  entityType: string;
  /** The widget context. Every read goes through it, so widgets on a page share one cache. */
  context: SgContext;
  value: FilterGroup;
  hidePaths?: string[];
  size?: FilterDialogSize;
  disabled?: boolean;
  /** Replaces both button labels. Otherwise Add filters, then Edit filters. */
  label?: string;
  title?: string;
  onValueChange?: (value: FilterGroup) => void;
  /** Whether the dialog is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  context,
  value = emptyFilter(),
  hidePaths = [],
  size = 'md',
  disabled = false,
  label,
  title = 'Filters',
  onValueChange,
  open: openProp,
  onOpenChange,
  fieldChooser,
  valueEditor,
  entityEditor,
  className,
  ref,
  ...rest
}: FilterDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [draft, setDraft] = useState<FilterGroup>(value);
  const active = countActiveConditions(value);

  function apply() {
    // A tree of blank rows is not a filter; it applies as no filter at all.
    onValueChange?.(isEmptyFilter(draft) ? emptyFilter() : draft);
    setOpen(false);
  }

  function clearAll() {
    onValueChange?.(emptyFilter());
    setOpen(false);
  }

  return (
    <div
      ref={ref}
      data-slot="filter-dialog"
      className={cn('inline-flex items-center gap-2', className)}
      {...rest}
    >
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
          data-size={size}
          className={cn(
            'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-1.5 rounded-lg border text-sm font-medium shadow-xs outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
            CONTROL_BOX[size],
          )}
        >
          {active > 0 ? (
            <>
              <PencilIcon className={CONTROL_GLYPH[size]} />
              {label ?? 'Edit filters'}
              <span
                data-slot="filter-count"
                className={cn(COUNT_CHIP, CHIP_BOX[COUNT[size]], CHIP_PAD[COUNT[size]].text)}
              >
                {active}
              </span>
            </>
          ) : (
            <>
              <ListFilterIcon className={CONTROL_GLYPH[size]} />
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
            context={context}
            hidePaths={hidePaths}
            size={size}
            value={draft}
            onValueChange={setDraft}
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
          size={ICON[size]}
          disabled={disabled}
          aria-label="Clear filters"
          data-slot="filter-clear"
          onClick={() => onValueChange?.(emptyFilter())}
        >
          <Trash2Icon />
        </Button>
      ) : null}
    </div>
  );
}
