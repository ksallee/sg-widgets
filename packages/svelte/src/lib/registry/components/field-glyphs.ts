/**
 * A glyph per field data type. Core names the lucide icon; this resolves the name
 * to the component, and a type core does not know takes the document.
 */
import type { Component } from 'svelte';
import { iconNameFor } from 'sg-widgets-core';
import Braces from '@lucide/svelte/icons/braces';
import Calendar from '@lucide/svelte/icons/calendar';
import CalendarClock from '@lucide/svelte/icons/calendar-clock';
import CircleDollarSign from '@lucide/svelte/icons/circle-dollar-sign';
import CircleDot from '@lucide/svelte/icons/circle-dot';
import FileText from '@lucide/svelte/icons/file-text';
import Fingerprint from '@lucide/svelte/icons/fingerprint';
import Globe from '@lucide/svelte/icons/globe';
import Hash from '@lucide/svelte/icons/hash';
import Image from '@lucide/svelte/icons/image';
import KeyRound from '@lucide/svelte/icons/key-round';
import Link from '@lucide/svelte/icons/link';
import Link2 from '@lucide/svelte/icons/link-2';
import List from '@lucide/svelte/icons/list';
import Palette from '@lucide/svelte/icons/palette';
import Percent from '@lucide/svelte/icons/percent';
import Ruler from '@lucide/svelte/icons/ruler';
import Shapes from '@lucide/svelte/icons/shapes';
import Sigma from '@lucide/svelte/icons/sigma';
import SquareCheck from '@lucide/svelte/icons/square-check';
import Tag from '@lucide/svelte/icons/tag';
import Timer from '@lucide/svelte/icons/timer';
import Type from '@lucide/svelte/icons/type';

/** Every icon core can name, by its lucide name. */
export const FIELD_GLYPHS: Record<string, Component> = {
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
	type: Type
};

/** The glyph for one data type, or the document every unknown type takes. */
export function fieldGlyph(dataType: string | null | undefined): Component {
	return FIELD_GLYPHS[iconNameFor(dataType ?? '')] ?? FileText;
}
