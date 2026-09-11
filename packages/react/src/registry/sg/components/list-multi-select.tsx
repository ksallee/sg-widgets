import type * as React from 'react';
import { useState } from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { statusLabel, usableStatuses } from '@sg-widgets/core';
import { ChevronDownIcon, SearchX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type ListMultiSelectSize = 'sm' | 'md' | 'lg';

/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
const BOX: Record<ListMultiSelectSize, string> = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-10',
};

/** The trigger, matching the select trigger of each registry. */
const TRIGGER =
  'border-input bg-background hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border px-3 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2';

export interface ListMultiSelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The chosen values, each one of the field's valid values (field_types/list). */
  value?: string[];
  onValueChange?: (value: string[]) => void;
  /** The field schema. Its valid values are the whole vocabulary a write may use. */
  field?: Pick<FieldSchema, 'displayName' | 'mandatory' | 'validValues' | 'displayValues' | 'hiddenValues'> | null;
  /**
   * The project the schema was read with. Given, the field's hidden values are
   * subtracted; REST does not enforce them on write, so the subtraction is the
   * client's (probe 009).
   */
  projectId?: number;
  size?: ListMultiSelectSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  /** A message from the caller. The list has nothing of its own to fail on. */
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * Several values of a `list` field.
 *
 * The vocabulary is the field's `valid_values`, byte for byte: a value outside it is
 * a 400 and the comparison is case-sensitive (field_types/list). With a project id
 * the field's hidden values are subtracted, which REST does not do on write.
 */
export function ListMultiSelect({
  value = [],
  onValueChange,
  field = null,
  projectId,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder = 'Select values',
  searchPlaceholder = 'Search values…',
  emptyLabel = 'No value.',
  open: openProp,
  onOpenChange,
  errorMessage,
  className,
  ...rest
}: ListMultiSelectProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;

  const options =
    projectId === undefined
      ? (field?.validValues ?? []).map((code) => ({ code, label: statusLabel(field ?? {}, code) }))
      : usableStatuses(field ?? {});

  // A row may hold a value outside the offered set; that is a legal stored value, so
  // it is shown as itself rather than dropped (probe 009).
  const labelOf = (code: string): string => options.find((option) => option.code === code)?.label ?? code;

  const label = value.length === 0 ? placeholder : value.map(labelOf).join(', ');

  const toggle = (code: string): void => {
    const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
    onErrorChange?.(null);
    onValueChange?.(next);
  };

  const setOpen = (next: boolean): void => {
    const wanted = readonly || disabled ? false : next;
    setUncontrolledOpen(wanted);
    onOpenChange?.(wanted);
  };

  return (
    <div
      data-slot="list-multi-select"
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-slot="list-multi-select-trigger"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid ? 'true' : undefined}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          data-empty={value.length === 0 ? '' : undefined}
          disabled={disabled || readonly}
          title={label}
          className={cn(TRIGGER, BOX[size])}
        >
          <span className={cn('min-w-0 truncate', value.length === 0 && 'text-muted-foreground')}>{label}</span>
          {value.length > 0 ? (
            <Badge variant="secondary" className="shrink-0">
              {value.length}
            </Badge>
          ) : (
            <ChevronDownIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          )}
        </PopoverTrigger>

        <PopoverContent align="start" className="w-64 gap-0 overflow-hidden p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <SearchX aria-hidden="true" className="size-4 shrink-0" />
                  {emptyLabel}
                </span>
              </CommandEmpty>
              {options.map((option) => (
                <CommandItem
                  key={option.code}
                  value={`${option.label} ${option.code}`}
                  data-option={option.code}
                  data-checked={value.includes(option.code) ? 'true' : undefined}
                  onSelect={() => toggle(option.code)}
                >
                  <Checkbox checked={value.includes(option.code)} tabIndex={-1} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error
        ? (errorMessage?.(error) ?? (
            <p data-slot="field-editor-error" className="text-destructive text-xs">
              {error}
            </p>
          ))
        : null}
    </div>
  );
}
