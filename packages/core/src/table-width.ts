/**
 * A fixed-layout table's column widths in the room it has: the last column takes what the others
 * leave, so the table fills its box; no column is ever narrowed below its own width. Only the last
 * grows, so a pinned column before it keeps its offset.
 */
export function fillWidths(sizes: readonly number[], room: number): number[] {
  const widths = [...sizes];
  if (widths.length === 0 || !Number.isFinite(room) || room <= 0) return widths;
  const total = widths.reduce((sum, size) => sum + size, 0);
  const extra = Math.floor(room) - total;
  const last = widths.length - 1;
  if (extra > 0) widths[last] = (widths[last] ?? 0) + extra;
  return widths;
}
