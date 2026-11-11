/**
 * A glyph per field data type. Core names the lucide icon; this resolves the name
 * to the component, and a type core does not know takes the document.
 */
import { iconNameFor } from 'sg-widgets-core';
import {
  Braces,
  Calendar,
  CalendarClock,
  CircleDollarSign,
  CircleDot,
  FileText,
  Fingerprint,
  Globe,
  Hash,
  Image,
  KeyRound,
  Link,
  Link2,
  List,
  Palette,
  Percent,
  Ruler,
  Shapes,
  Sigma,
  SquareCheck,
  Tag,
  Timer,
  Type,
  type LucideIcon,
} from 'lucide-react';

/** Every icon core can name, by its lucide name. */
export const FIELD_GLYPHS: Record<string, LucideIcon> = {
  braces: Braces,
  calendar: Calendar,
  'calendar-clock': CalendarClock,
  'circle-dollar-sign': CircleDollarSign,
  'circle-dot': CircleDot,
  'file-text': FileText,
  fingerprint: Fingerprint,
  globe: Globe,
  hash: Hash,
  image: Image,
  'key-round': KeyRound,
  link: Link,
  'link-2': Link2,
  list: List,
  palette: Palette,
  percent: Percent,
  ruler: Ruler,
  shapes: Shapes,
  sigma: Sigma,
  'square-check': SquareCheck,
  tag: Tag,
  timer: Timer,
  type: Type,
};

/** The glyph for one data type, or the document every unknown type takes. */
export function fieldGlyph(dataType: string | null | undefined): LucideIcon {
  return FIELD_GLYPHS[iconNameFor(dataType ?? '')] ?? FileText;
}
