"use client"

import * as React from "react"
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete"
import { watchOverflow } from "sg-widgets-core"
import { cn } from "@/lib/utils"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
} from "@/components/ui/input-group"
import { SearchIcon, CheckIcon } from "lucide-react"

/**
 * A preset over Base UI's Autocomplete: a list that is always open, always rendered
 * in place, and always holds a highlight. Reference: coss.com/ui at e937bec.
 *
 * `query` is what the box is searching for. A list whose matching is the server's
 * passes `shouldFilter={false}`; a list that filters what it was given passes its
 * values as `items`, which is also what `CommandEmpty` counts.
 */
function Command({
  className,
  query,
  onQueryChange,
  shouldFilter = true,
  items,
  loop = false,
  onKeyDown,
  children,
  ...props
}: Omit<React.ComponentProps<typeof AutocompletePrimitive.Root>, "value" | "onValueChange" | "filter" | "items" | "loopFocus"> & {
  className?: string
  query?: string
  onQueryChange?: (query: string) => void
  shouldFilter?: boolean
  items?: readonly unknown[]
  /** Down past the last row returns to the first. Off, as it is on Bits UI. */
  loop?: boolean
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
}) {
  return (
    <AutocompletePrimitive.Root
      autoHighlight="always"
      keepHighlight
      inline
      open
      loopFocus={loop}
      items={items}
      filter={shouldFilter ? undefined : null}
      value={query}
      onValueChange={onQueryChange}
      {...props}
    >
      <div
        data-slot="command"
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
          className
        )}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </AutocompletePrimitive.Root>
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0",
          className
        )}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-3!">
        <AutocompletePrimitive.Input
          data-slot="command-input"
          className={cn(
            "w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.List>) {
  const [list, setList] = React.useState<HTMLDivElement | null>(null)
  // The list writes the overflow variables the fade reads, which are Base UI's own.
  React.useEffect(() => watchOverflow(list), [list])
  return (
    <AutocompletePrimitive.List
      ref={setList}
      data-slot="command-list"
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        "[scrollbar-gutter:stable] [--fade-size:1.5rem] mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start,0px)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end,0px)))]",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Empty>) {
  return (
    <AutocompletePrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  )
}

/** The list's live region: what a reader hears, beside what the state line shows. */
function CommandStatus({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn("sr-only", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Group> & { heading?: React.ReactNode }) {
  return (
    <AutocompletePrimitive.Group
      data-slot="command-group"
      className={cn("overflow-hidden p-1 text-foreground", className)}
      {...props}
    >
      {heading ? (
        <AutocompletePrimitive.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </AutocompletePrimitive.GroupLabel>
      ) : null}
      {children}
    </AutocompletePrimitive.Group>
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Separator>) {
  return (
    <AutocompletePrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  onSelect,
  ...props
}: Omit<React.ComponentProps<typeof AutocompletePrimitive.Item>, "onSelect"> & {
  onSelect?: () => void
}) {
  return (
    <AutocompletePrimitive.Item
      data-slot="command-item"
      onClick={onSelect ? () => onSelect() : undefined}
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 has-[[data-slot=picker-row-sub-label]]:py-1 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-highlighted:*:[svg]:text-foreground",
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </AutocompletePrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-highlighted/command-item:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandStatus,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
