/**
 * The calendar day the two date editors hand the Calendar primitive.
 *
 * The split and the padding are core's; only the shape react-day-picker takes
 * lives here, which is why this is not in core.
 */
import { isoDay, isoDayParts } from '@sg-widgets/core';

/** `YYYY-MM-DD` as a calendar day, or undefined when the string is not one (field_types/date). */
export function toCalendarDate(value: string | null | undefined): Date | undefined {
  const parts = isoDayParts(value);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : undefined;
}

/** The picked day back as `YYYY-MM-DD`, or the empty string when nothing is picked. */
export function fromCalendarDate(value: Date | undefined): string {
  if (!value) return '';
  return isoDay({ year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() });
}
