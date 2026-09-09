/**
 * Ordered lists that reorder by pointer and by keyboard.
 *
 * The model answers what a move does to an order and what a screen reader should
 * be told about it. The controller binds one list element: it turns pointer
 * events into a drag, moves the rows out of the way with a transform, runs the
 * keyboard drag mode, and calls back with the new order. A framework binding
 * wires the two together and renders the live region; it decides nothing here.
 */

export type SortableDirection = 'up' | 'down';
export type SortableOrientation = 'vertical' | 'horizontal';

/** The edges of an item, as `getBoundingClientRect` gives them. */
export interface SortableRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SortablePoint {
  x: number;
  y: number;
}

/** The attribute carrying an item's id. It is what the controller walks the list by. */
export const SORTABLE_ID_ATTRIBUTE = 'data-sortable-id';
/** The attribute marking the element a drag starts from. */
export const SORTABLE_HANDLE_ATTRIBUTE = 'data-sortable-handle';

/* -------------------------------------------------------------------------- */
/* announcements                                                              */
/* -------------------------------------------------------------------------- */

/** The live-region copy, one line per gesture step. Indexes are counted from zero. */
export const sortableAnnouncements = {
  pickup: (label: string, index: number, count: number): string =>
    `Picked up ${label}, position ${index + 1} of ${count}`,
  move: (label: string, index: number, count: number): string =>
    `Moved ${label} to position ${index + 1} of ${count}`,
  drop: (label: string): string => `Dropped ${label}`,
  cancel: (): string => 'Cancelled',
};

/* -------------------------------------------------------------------------- */
/* model                                                                      */
/* -------------------------------------------------------------------------- */

export interface SortableModelOptions {
  /** The name announced for an id. The id itself by default. */
  label?: (id: string) => string;
}

export interface SortableModel {
  readonly ids: readonly string[];
  indexOf(id: string): number;
  labelOf(id: string): string;
  /** The order with the entry at `from` moved to `to`. An index off either end leaves it alone. */
  moveTo(from: number, to: number): string[];
  /** The order with `id` moved one place towards the start or the end. */
  keyboardMove(id: string, direction: SortableDirection): string[];
  pickedUp(id: string): string;
  movedTo(id: string, index: number): string;
  dropped(id: string): string;
  cancelled(): string;
}

/** A frozen view of one order: every move answers with a new array. */
export function createSortable(ids: readonly string[], options: SortableModelOptions = {}): SortableModel {
  const list = [...ids];
  const label = (id: string): string => options.label?.(id) ?? id;

  const moveTo = (from: number, to: number): string[] => {
    const next = [...list];
    if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved as string);
    return next;
  };

  return {
    ids: list,
    indexOf: (id) => list.indexOf(id),
    labelOf: label,
    moveTo,
    keyboardMove(id, direction) {
      const from = list.indexOf(id);
      return from === -1 ? [...list] : moveTo(from, from + (direction === 'up' ? -1 : 1));
    },
    pickedUp: (id) => sortableAnnouncements.pickup(label(id), list.indexOf(id), list.length),
    movedTo: (id, index) => sortableAnnouncements.move(label(id), index, list.length),
    dropped: (id) => sortableAnnouncements.drop(label(id)),
    cancelled: () => sortableAnnouncements.cancel(),
  };
}

/* -------------------------------------------------------------------------- */
/* hit testing                                                                */
/* -------------------------------------------------------------------------- */

function midpointOf(rect: SortableRect, orientation: SortableOrientation): number {
  return orientation === 'vertical' ? (rect.top + rect.bottom) / 2 : (rect.left + rect.right) / 2;
}

function along(point: SortablePoint, orientation: SortableOrientation): number {
  return orientation === 'vertical' ? point.y : point.x;
}

/**
 * The index an item dragged from `from` lands on.
 *
 * `rects` are the items in list order, measured before the drag; `point` is the
 * dragged item's own midpoint, moved by the pointer. A neighbour's place is
 * claimed once its midpoint is crossed, so the far edge of a tall row does not
 * take a place the item is only overlapping.
 */
export function sortableDropIndex(
  rects: readonly SortableRect[],
  from: number,
  point: SortablePoint,
  orientation: SortableOrientation = 'vertical',
): number {
  if (from < 0 || from >= rects.length) return from;
  const at = along(point, orientation);
  for (let i = rects.length - 1; i > from; i--) {
    if (at > midpointOf(rects[i] as SortableRect, orientation)) return i;
  }
  for (let i = 0; i < from; i++) {
    if (at < midpointOf(rects[i] as SortableRect, orientation)) return i;
  }
  return from;
}

/** How far one item sits from the next, so the rows a drag passes shift by a whole row. */
export function sortableStride(
  rects: readonly SortableRect[],
  from: number,
  orientation: SortableOrientation = 'vertical',
): number {
  const size = (rect: SortableRect): number =>
    orientation === 'vertical' ? rect.bottom - rect.top : rect.right - rect.left;
  const start = (rect: SortableRect): number => (orientation === 'vertical' ? rect.top : rect.left);
  const current = rects[from];
  if (!current) return 0;
  const next = rects[from + 1];
  if (next) return start(next) - start(current);
  const previous = rects[from - 1];
  if (previous) return start(current) - start(previous);
  return size(current);
}

export interface SortableScrollOptions {
  /** How near an edge the pointer has to be before the container scrolls. */
  threshold?: number;
  /** Pixels per frame at the edge itself. */
  speed?: number;
  orientation?: SortableOrientation;
}

/**
 * Pixels to scroll the container this frame, negative towards the start.
 *
 * Zero until the pointer is inside `threshold` of an edge, then proportional to
 * how far past it, up to `speed` at the edge and beyond.
 */
export function sortableScrollStep(
  bounds: SortableRect,
  point: SortablePoint,
  options: SortableScrollOptions = {},
): number {
  const { threshold = 48, speed = 12, orientation = 'vertical' } = options;
  const at = along(point, orientation);
  const start = orientation === 'vertical' ? bounds.top : bounds.left;
  const end = orientation === 'vertical' ? bounds.bottom : bounds.right;
  if (threshold <= 0 || end - start <= threshold * 2) return 0;
  if (at < start + threshold) return -Math.min(1, (start + threshold - at) / threshold) * speed;
  if (at > end - threshold) return Math.min(1, (at - (end - threshold)) / threshold) * speed;
  return 0;
}

/* -------------------------------------------------------------------------- */
/* motion                                                                     */
/* -------------------------------------------------------------------------- */

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function itemsOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(`[${SORTABLE_ID_ATTRIBUTE}]`)];
}

function idOf(element: HTMLElement): string {
  return element.getAttribute(SORTABLE_ID_ATTRIBUTE) ?? '';
}

/**
 * Where every item of the list sits, by id, in document coordinates.
 *
 * A measurement is compared with one taken later, and the page may have scrolled in
 * between; viewport rects would read that scroll as a move of every row.
 */
export function measureSortable(container: HTMLElement): Map<string, SortableRect> {
  const measured = new Map<string, SortableRect>();
  const x = typeof scrollX === 'number' ? scrollX : 0;
  const y = typeof scrollY === 'number' ? scrollY : 0;
  for (const element of itemsOf(container)) {
    const { top, bottom, left, right } = element.getBoundingClientRect();
    measured.set(idOf(element), { top: top + y, bottom: bottom + y, left: left + x, right: right + x });
  }
  return measured;
}

export interface SortableFlipOptions {
  duration?: number;
}

/**
 * Move every item from where it was to where it is now, transform only.
 *
 * Called after the order has changed and the list has been redrawn. Returns the
 * fresh measurement to hold for the next change. Under reduced motion the items
 * are left where they are.
 */
export function playSortableFlip(
  container: HTMLElement,
  previous: Map<string, SortableRect> | null,
  options: SortableFlipOptions = {},
): Map<string, SortableRect> {
  const duration = options.duration ?? 200;
  const next = measureSortable(container);
  if (!previous || reducedMotion()) return next;
  for (const element of itemsOf(container)) {
    const id = idOf(element);
    const was = previous.get(id);
    const now = next.get(id);
    if (!was || !now) continue;
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    element.style.transition = 'none';
    element.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    // Reading the layout commits the offset, so the transition below runs from it
    // rather than being coalesced away with it.
    void element.offsetHeight;
    element.style.transition = `transform ${duration}ms ease-out`;
    element.style.transform = '';
    element.addEventListener(
      'transitionend',
      () => {
        element.style.transition = '';
      },
      { once: true },
    );
  }
  return next;
}

/* -------------------------------------------------------------------------- */
/* controller                                                                 */
/* -------------------------------------------------------------------------- */

export interface SortableControllerOptions {
  /** The element holding the items. */
  container: HTMLElement;
  /** The ids in their current order. Read at the start of every gesture and on every move. */
  order: () => readonly string[];
  /** The new order and the id that moved. */
  onOrderChange: (order: string[], id: string) => void;
  /** The name announced for an id. */
  label?: (id: string) => string;
  /** One line for the live region. */
  onAnnounce?: (message: string) => void;
  /** The id under a live gesture, or null when it ends. */
  onDraggingChange?: (id: string | null) => void;
  /** How far the pointer travels before a drag starts. */
  activationDistance?: number;
  /** How long the rows a drag passes take to shift. */
  duration?: number;
  orientation?: SortableOrientation;
  /** A true blocks every gesture. */
  disabled?: () => boolean;
}

export interface SortableController {
  /** The id under a live gesture, pointer or keyboard. */
  readonly active: string | null;
  /**
   * Set when a pointer drop has just committed a new order. The rows are already
   * where the drag left them, so a binding clears this and re-measures instead of
   * animating the change a second time.
   */
  settled: boolean;
  destroy(): void;
}

interface DragItem {
  id: string;
  element: HTMLElement;
  /** Content coordinates: the viewport rect plus the scroller's offset at pickup. */
  rect: SortableRect;
}

function scrollerOf(element: HTMLElement, orientation: SortableOrientation): HTMLElement | null {
  let node: HTMLElement | null = element;
  while (node) {
    const style = getComputedStyle(node);
    const overflow = orientation === 'vertical' ? style.overflowY : style.overflowX;
    const scrollable = overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay';
    const overflows =
      orientation === 'vertical'
        ? node.scrollHeight > node.clientHeight
        : node.scrollWidth > node.clientWidth;
    if (scrollable && overflows) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Pointer and keyboard reordering over one list element.
 *
 * A drag starts on an element carrying the handle attribute, once the pointer has
 * travelled `activationDistance`; the dragged row follows the pointer and the rows
 * it passes shift by one row with a transform, so the gap left behind is the drop
 * slot. Escape cancels. Space or Enter on a handle enters keyboard drag mode,
 * where the arrow keys move the row a place at a time, Space, Enter or losing
 * focus drops it, and Escape puts it back.
 */
export function createSortableController(options: SortableControllerOptions): SortableController {
  const {
    container,
    order,
    onOrderChange,
    label,
    onAnnounce,
    onDraggingChange,
    activationDistance = 4,
    duration = 200,
    orientation = 'vertical',
    disabled,
  } = options;

  const state = { active: null as string | null, settled: false };

  /* gesture-independent helpers */

  const model = (): SortableModel => createSortable(order(), label ? { label } : {});
  const say = (message: string): void => onAnnounce?.(message);

  function setActive(id: string | null): void {
    state.active = id;
    if (id !== null) state.settled = false;
    onDraggingChange?.(id);
  }

  function handleFrom(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const handle = target.closest<HTMLElement>(`[${SORTABLE_HANDLE_ATTRIBUTE}]`);
    return handle && container.contains(handle) ? handle : null;
  }

  function itemFrom(handle: HTMLElement): HTMLElement | null {
    return handle.closest<HTMLElement>(`[${SORTABLE_ID_ATTRIBUTE}]`);
  }

  function clearMarks(): void {
    for (const element of itemsOf(container)) {
      element.removeAttribute('data-dragging');
      element.removeAttribute('data-drop-target');
      element.style.transition = '';
      element.style.transform = '';
      element.style.zIndex = '';
    }
  }

  /* pointer */

  let pending: { id: string; origin: SortablePoint; pointerId: number } | null = null;
  let drag:
    | {
        id: string;
        items: DragItem[];
        from: number;
        to: number;
        stride: number;
        origin: SortablePoint;
        pointer: SortablePoint;
        scroller: HTMLElement | null;
        startScroll: number;
        frame: number;
      }
    | null = null;

  const scrollTopOf = (scroller: HTMLElement | null): number =>
    scroller ? (orientation === 'vertical' ? scroller.scrollTop : scroller.scrollLeft) : 0;

  function translate(offset: number): string {
    return orientation === 'vertical'
      ? `translate3d(0, ${offset}px, 0)`
      : `translate3d(${offset}px, 0, 0)`;
  }

  function beginDrag(): void {
    if (!pending) return;
    const { id, origin } = pending;
    const scroller = scrollerOf(container, orientation);
    const offset = scrollTopOf(scroller);
    const items: DragItem[] = itemsOf(container).map((element) => {
      const { top, bottom, left, right } = element.getBoundingClientRect();
      return orientation === 'vertical'
        ? { id: idOf(element), element, rect: { top: top + offset, bottom: bottom + offset, left, right } }
        : { id: idOf(element), element, rect: { top, bottom, left: left + offset, right: right + offset } };
    });
    const from = items.findIndex((item) => item.id === id);
    if (from === -1) {
      pending = null;
      return;
    }
    const rects = items.map((item) => item.rect);
    drag = {
      id,
      items,
      from,
      to: from,
      stride: sortableStride(rects, from, orientation),
      origin,
      pointer: origin,
      scroller,
      startScroll: offset,
      frame: 0,
    };
    pending = null;
    const item = items[from] as DragItem;
    item.element.setAttribute('data-dragging', 'true');
    item.element.style.zIndex = '1';
    container.style.userSelect = 'none';
    setActive(id);
    say(model().pickedUp(id));
    if (scroller) drag.frame = requestAnimationFrame(autoScroll);
  }

  function project(): void {
    if (!drag) return;
    const offset = scrollTopOf(drag.scroller) - drag.startScroll;
    const delta =
      (orientation === 'vertical' ? drag.pointer.y - drag.origin.y : drag.pointer.x - drag.origin.x) + offset;
    const rects = drag.items.map((item) => item.rect);
    const centre = midpointOf(rects[drag.from] as SortableRect, orientation) + delta;
    drag.to = sortableDropIndex(
      rects,
      drag.from,
      orientation === 'vertical' ? { x: drag.pointer.x, y: centre } : { x: centre, y: drag.pointer.y },
      orientation,
    );
    const shifts = !reducedMotion();
    for (let i = 0; i < drag.items.length; i++) {
      const { element } = drag.items[i] as DragItem;
      if (i === drag.from) {
        element.style.transition = 'none';
        element.style.transform = translate(delta);
        continue;
      }
      const shift =
        i > drag.from && i <= drag.to ? -drag.stride : i < drag.from && i >= drag.to ? drag.stride : 0;
      element.style.transition = shifts ? `transform ${duration}ms ease-out` : 'none';
      element.style.transform = shift === 0 ? '' : translate(shift);
      if (i === drag.to && drag.to !== drag.from) element.setAttribute('data-drop-target', 'true');
      else element.removeAttribute('data-drop-target');
    }
  }

  function autoScroll(): void {
    if (!drag?.scroller) return;
    const { top, bottom, left, right } = drag.scroller.getBoundingClientRect();
    const step = sortableScrollStep({ top, bottom, left, right }, drag.pointer, { orientation });
    if (step !== 0) {
      if (orientation === 'vertical') drag.scroller.scrollTop += step;
      else drag.scroller.scrollLeft += step;
      project();
    }
    drag.frame = requestAnimationFrame(autoScroll);
  }

  function endDrag(cancelled: boolean): void {
    if (!drag) return;
    const { id, from, to, frame } = drag;
    if (frame) cancelAnimationFrame(frame);
    drag = null;
    clearMarks();
    container.style.userSelect = '';
    setActive(null);
    if (cancelled || to === from) {
      say(cancelled ? sortableAnnouncements.cancel() : model().dropped(id));
      return;
    }
    const held = model();
    state.settled = true;
    onOrderChange(held.moveTo(from, to), id);
    say(held.movedTo(id, to));
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || disabled?.() || drag || keyboard) return;
    const handle = handleFrom(event.target);
    if (!handle) return;
    const item = itemFrom(handle);
    if (!item) return;
    pending = { id: idOf(item), origin: { x: event.clientX, y: event.clientY }, pointerId: event.pointerId };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onDragKey, true);
  }

  function onPointerMove(event: PointerEvent): void {
    if (pending && event.pointerId === pending.pointerId) {
      const travelled = Math.hypot(event.clientX - pending.origin.x, event.clientY - pending.origin.y);
      if (travelled < activationDistance) return;
      beginDrag();
    }
    if (!drag) return;
    event.preventDefault();
    drag.pointer = { x: event.clientX, y: event.clientY };
    project();
  }

  function onPointerUp(): void {
    releasePointer();
    if (drag) endDrag(false);
  }

  function onDragKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    releasePointer();
    endDrag(true);
  }

  function releasePointer(): void {
    pending = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onDragKey, true);
  }

  /* keyboard */

  let keyboard: { id: string; origin: string[] } | null = null;

  function endKeyboard(): void {
    keyboard = null;
    clearMarks();
    setActive(null);
  }

  function onKeyDown(event: KeyboardEvent): void {
    const handle = handleFrom(event.target);
    if (!handle) return;
    const item = itemFrom(handle);
    if (!item) return;
    const id = idOf(item);

    if (!keyboard) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (disabled?.() || drag) return;
      event.preventDefault();
      keyboard = { id, origin: [...order()] };
      item.setAttribute('data-dragging', 'true');
      setActive(id);
      say(model().pickedUp(id));
      return;
    }
    if (keyboard.id !== id) return;

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const held = model();
      const next = held.keyboardMove(id, event.key === 'ArrowUp' ? 'up' : 'down');
      const to = next.indexOf(id);
      if (to === held.indexOf(id)) return;
      onOrderChange(next, id);
      say(held.movedTo(id, to));
      handle.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      say(model().dropped(id));
      endKeyboard();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      const restored = keyboard.origin;
      endKeyboard();
      onOrderChange([...restored], id);
      say(sortableAnnouncements.cancel());
    }
  }

  /** Focus leaving the list drops what it was carrying rather than stranding it. */
  function onFocusOut(event: FocusEvent): void {
    if (!keyboard) return;
    const next = event.relatedTarget;
    if (next instanceof Node && container.contains(next)) return;
    say(model().dropped(keyboard.id));
    endKeyboard();
  }

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('keydown', onKeyDown);
  container.addEventListener('focusout', onFocusOut);

  return {
    get active() {
      return state.active;
    },
    get settled() {
      return state.settled;
    },
    set settled(next: boolean) {
      state.settled = next;
    },
    destroy() {
      releasePointer();
      if (drag?.frame) cancelAnimationFrame(drag.frame);
      drag = null;
      keyboard = null;
      container.style.userSelect = '';
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('focusout', onFocusOut);
    },
  };
}
