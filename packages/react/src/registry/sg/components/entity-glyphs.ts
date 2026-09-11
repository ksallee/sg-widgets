/**
 * A glyph per entity type. A stock site has 114 types plus any number of custom
 * ones, so this covers the types a widget meets constantly and falls back to a tag.
 */
import {
  Box,
  Clapperboard,
  FileBox,
  Film,
  Folder,
  ListChecks,
  MessageSquare,
  Tag,
  User,
  Video,
  type LucideIcon,
} from 'lucide-react';

export const ENTITY_GLYPHS: Record<string, LucideIcon> = {
  Shot: Clapperboard,
  Asset: Box,
  Sequence: Film,
  Version: Video,
  Task: ListChecks,
  HumanUser: User,
  Project: Folder,
  Note: MessageSquare,
  PublishedFile: FileBox,
};

/** The glyph for one type, or the tag every unlisted type takes. */
export function entityGlyph(type: string | null | undefined): LucideIcon {
  return ENTITY_GLYPHS[type ?? ''] ?? Tag;
}
