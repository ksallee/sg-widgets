import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SortableController, SortableOrientation, SortableRect } from 'sg-widgets-core';
import { createSortableController, measureSortable, playSortableFlip } from 'sg-widgets-core';

export interface UseSortableOptions {
  /** The ids in the order they are drawn, one per item element. */
  ids: readonly string[];
  /** The new order and the id that moved. */
  onOrderChange: (order: string[], id: string) => void;
  /** The name announced for an id. The id itself by default. */
  label?: (id: string) => string;
  disabled?: boolean;
  orientation?: SortableOrientation;
}

export interface Sortable<E extends HTMLElement = HTMLElement> {
  /** Goes on the list element, whose children carry `data-sortable-id`. */
  ref: (element: E | null) => void;
  /** The id under a live gesture, pointer or keyboard. */
  dragging: string | null;
  /** The last line to put in the list's live region. */
  announcement: string;
}

/**
 * Pointer and keyboard reordering for one list.
 *
 * Put `ref` on the element holding the items, give each item a `data-sortable-id`
 * and each grip a `data-sortable-handle`, and render `announcement` in a polite
 * live region. A pointer drag lifts the row and shifts the ones it passes; the
 * dragged row is marked `data-dragging` and the row it would displace
 * `data-drop-target`. Every other change of order is played as a transform from
 * where each row was, and reduced motion leaves the rows where they are.
 */
export function useSortable<E extends HTMLElement = HTMLElement>(
  options: UseSortableOptions,
): Sortable<E> {
  const [element, setElement] = useState<E | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const latest = useRef(options);
  const controller = useRef<SortableController | null>(null);
  const previous = useRef<Map<string, SortableRect> | null>(null);
  const orientation = options.orientation ?? 'vertical';
  const ref = useCallback((node: E | null) => setElement(node), []);

  // The controller reads its options in event handlers, which run after this.
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    if (!element) return;
    const held = createSortableController({
      container: element,
      orientation,
      order: () => latest.current.ids,
      onOrderChange: (order, id) => latest.current.onOrderChange(order, id),
      label: (id) => latest.current.label?.(id) ?? id,
      disabled: () => latest.current.disabled === true,
      onAnnounce: setAnnouncement,
      onDraggingChange: setDragging,
    });
    controller.current = held;
    previous.current = measureSortable(element);
    return () => {
      held.destroy();
      controller.current = null;
      previous.current = null;
    };
  }, [element, orientation]);

  // A pointer drop leaves the rows where the drag put them, so that one change is
  // re-measured rather than played a second time.
  const order = options.ids.join('\n');
  useLayoutEffect(() => {
    if (!element) return;
    const held = controller.current;
    if (held?.settled) {
      held.settled = false;
      previous.current = measureSortable(element);
      return;
    }
    previous.current = playSortableFlip(element, previous.current);
  }, [element, order]);

  return { ref, dragging, announcement };
}
