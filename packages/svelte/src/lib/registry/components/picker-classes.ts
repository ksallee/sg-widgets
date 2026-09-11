/**
 * The chrome every picker in this registry wears.
 *
 * One control, one popup, one list, one row, so the pickers cannot drift from each
 * other or from the React registry. The scale and the states are
 * `docs/design-rules.md`; nothing here is a colour of its own.
 */

/** The control ladder: the three heights of the design rules. */
export type PickerSize = 'sm' | 'md' | 'lg';

/**
 * The box a control sits in. A filled control's leading inset matches the room above and
 * below its chip, so the chip sits evenly inside the border; `data-empty` gives the
 * reading inset of a plain input back, and takes the vertical inset down one step.
 * `min-h` holds the ladder and the trailing inset stays reserve for the clear and open
 * controls.
 *
 * The vertical inset is what the chip leaves under the ladder: 24 plus 8 fits under 36 at
 * md, while 24 under 32 at sm and 32 under 40 at lg leave 2 each, so those two take the
 * half step. Anything more and a filled control overruns the ladder.
 */
export const PICKER_BOX: Record<PickerSize, string> = {
	sm: 'min-h-8 pr-2 pl-[5px] py-0.5 data-empty:pl-1.5 data-empty:py-0',
	md: 'min-h-9 pr-3 pl-[5px] py-1 data-empty:pl-2 data-empty:py-0.5',
	lg: 'min-h-10 pr-3 pl-1 py-0.5 data-empty:pl-2 data-empty:py-0'
};

/**
 * The box a control whose filled value is plain text sits in. Rule 3 of
 * `docs/design-rules.md`: there is no chip to sit level with, so the control keeps the
 * reading inset, and `data-empty` takes it one step tighter.
 */
export const PICKER_TEXT_BOX: Record<PickerSize, string> = {
	sm: 'min-h-8 px-2 data-empty:pl-1.5',
	md: 'min-h-9 px-3 data-empty:pl-2',
	lg: 'min-h-10 px-3 data-empty:pl-2'
};

/**
 * The trailing controls ride the first row of the control: they centre on a control that
 * holds one line and stay with that row when the value wraps below it. Only md stretches
 * past its chip row to hold the ladder, so one height cannot serve both states there; it
 * takes the ladder, which is exact on one line and 2px high when the value wraps.
 */
export const PICKER_TRAILING: Record<PickerSize, string> = {
	sm: 'h-8',
	md: 'h-9',
	lg: 'h-10'
}

/** The glyphs inside a control. */
export const PICKER_GLYPH: Record<PickerSize, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' };

/** A chip or a badge sits inside the control, so it takes the step below it. */
export const PICKER_CHIP: Record<PickerSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

/** The bordered field the chips and the query input sit in. */
export const PICKER_CONTROL =
	'border-input bg-background hover:bg-muted/30 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-background has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 data-invalid:border-destructive data-invalid:ring-destructive/20 dark:data-invalid:ring-destructive/40 relative flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-lg border text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-aria-invalid:ring-2 data-invalid:ring-2';

/** The combobox input of a single picker: no box of its own, it borrows the control's. */
export const PICKER_INPUT =
	'placeholder:text-muted-foreground relative min-w-8 flex-1 bg-transparent outline-none disabled:cursor-not-allowed';

/** The caret of a token field, which gives its room to the chips. */
export const PICKER_TOKEN_INPUT =
	'placeholder:text-muted-foreground relative min-w-[2ch] flex-1 bg-transparent outline-none disabled:cursor-not-allowed';

/** The search box a summary trigger keeps in its popup instead. */
export const PICKER_SEARCH_ROW = 'border-border flex items-center gap-1.5 border-b px-3';
export const PICKER_SEARCH =
	'placeholder:text-muted-foreground h-9 w-full min-w-0 bg-transparent text-sm outline-none disabled:cursor-not-allowed';

/** The `+n` pill. A press on it opens the list, where the hidden ones are. */
export const PICKER_PILL =
	'text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm text-xs tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2';

/** Room the `+n` pill needs beside the chips, so it is never the thing that overflows. */
export const OVERFLOW_RESERVE = 40;

/** The chip row's `gap-1.5`, carried by every measured width. */
export const CHIP_GAP = 6;

/** The popup surface, matching the popover item of this registry. */
export const PICKER_POPUP =
	'bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 ring-foreground/10 z-50 w-96 max-w-[calc(100vw-2rem)] origin-(--bits-combobox-content-transform-origin) overflow-hidden rounded-lg shadow-md ring-1 outline-hidden duration-100';

/** The same popup, as wide as the control it hangs off. */
export const PICKER_ANCHORED_POPUP =
	'bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 ring-foreground/10 z-50 w-(--bits-combobox-anchor-width) min-w-56 origin-(--bits-combobox-content-transform-origin) overflow-hidden rounded-lg shadow-md ring-1 outline-hidden duration-100';

/**
 * The fade on a scrolling list's edges, and the gutter its scrollbar sits in.
 *
 * An edge is faded by the smaller of the fade's own width and the room past it, so an
 * edge with nothing beyond it is not faded at all. The two distances are the variables
 * core's `watchOverflow` writes, which are Base UI's own, so one class string serves
 * both registries.
 */
export const LIST_FADE =
	'[scrollbar-gutter:stable] [--fade-size:1.5rem] mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start,0px)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end,0px)))]';

/** The scrolling list inside the popup, fading at whichever edge has more past it. */
export const PICKER_LIST =
	`no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto p-1 outline-none ${LIST_FADE}`;

/**
 * The list's live region. It says what the visible block says and nothing more: the
 * state line stays the thing a reader sees, this row is the thing a reader hears.
 */
export const LIST_STATUS = 'sr-only';

/**
 * The row's indicator column, drawn whether or not the row is ticked, so a label sits
 * at one x down the whole list.
 */
export const PICKER_ROW_INDICATOR = 'flex h-5 w-4 shrink-0 items-center justify-center';

/** One row. Highlight and selection share one colour, per `docs/design-rules.md`. */
export const PICKER_ROW =
	'data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';

/** The clear control, shared by every picker in this registry. */
export const PICKER_ICON_BUTTON =
	'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]';

/** The chip a Backspace has armed: the focus ring, inset so the chip row's clipping and the control's edge never cut it. */
export const PICKER_ARMED = 'ring-ring ring-2 ring-inset';

/** A chosen code in the control. A code is not a row, so it has no thumbnail. */
export const PICKER_TEXT_CHIP =
	'bg-muted text-foreground flex min-w-0 shrink-0 items-center gap-1.5 rounded-md px-1.5';

/** A code wears the leaf ladder an entity chip wears, so a control insets either alike. */
export const PICKER_TEXT_CHIP_BOX: Record<PickerSize, string> = {
	sm: 'h-6 text-xs',
	md: 'h-6 text-xs',
	lg: 'h-8 text-sm'
};
