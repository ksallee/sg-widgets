import type { SortableOrientation, SortableRect } from 'sg-widgets-core';
import { createSortableController, measureSortable, playSortableFlip } from 'sg-widgets-core';

export interface SortableOptions {
	/** The ids in the order they are drawn, one per item element. */
	ids: () => readonly string[];
	/** The new order and the id that moved. */
	onOrderChange: (order: string[], id: string) => void;
	/** The name announced for an id. The id itself by default. */
	label?: (id: string) => string;
	disabled?: () => boolean;
	orientation?: SortableOrientation;
}

export interface Sortable {
	/** Attached to the list element, whose children carry `data-sortable-id`. */
	attach: (element: HTMLElement) => () => void;
	/** The id under a live gesture, pointer or keyboard. */
	readonly dragging: string | null;
	/** The last line to put in the list's live region. */
	readonly announcement: string;
}

/**
 * Pointer and keyboard reordering for one list.
 *
 * Attach it to the element holding the items, give each item a `data-sortable-id`
 * and each grip a `data-sortable-handle`, and render `announcement` in a polite
 * live region. A pointer drag lifts the row and shifts the ones it passes; the
 * controller marks the dragged row `data-dragging` and the row it would displace
 * `data-drop-target`. Every other change of order is played as a transform from
 * where each row was, and reduced motion leaves the rows where they are.
 */
export function createSortable(options: SortableOptions): Sortable {
	let dragging = $state<string | null>(null);
	let announcement = $state('');
	let previous: Map<string, SortableRect> | null = null;

	return {
		get dragging() {
			return dragging;
		},
		get announcement() {
			return announcement;
		},
		attach(element: HTMLElement) {
			const held = createSortableController({
				container: element,
				orientation: options.orientation ?? 'vertical',
				order: options.ids,
				onOrderChange: options.onOrderChange,
				label: (id) => options.label?.(id) ?? id,
				disabled: () => options.disabled?.() === true,
				onAnnounce: (message) => (announcement = message),
				onDraggingChange: (id) => (dragging = id)
			});
			previous = measureSortable(element);

			// A pointer drop leaves the rows where the drag put them, so that one change
			// is re-measured rather than played again.
			// The list is tracked by its order, so a change to a row's fields plays nothing.
			const order = $derived(options.ids().join('\n'));
			$effect(() => {
				void order;
				if (held.settled) {
					held.settled = false;
					previous = measureSortable(element);
					return;
				}
				previous = playSortableFlip(element, previous);
			});

			return () => held.destroy();
		}
	};
}
