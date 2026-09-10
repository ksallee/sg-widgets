/**
 * A stand-in for a site's stock icon sprite.
 *
 * An `image_map` icon outside the set the core package bundles draws from the sprite the
 * customer's own site serves, at this path (010_status_icons). No site is reachable from
 * a demo, so the status-badge demo points here instead: the cell offsets it computes are
 * the real ones, and this sheet is one flat colour, so a cell reads as a block rather
 * than as Autodesk's artwork. It covers the top-left corner of the sheet only.
 */
import type { APIRoute } from 'astro';

/* 128x16, RGBA, every pixel the same neutral grey. */
const SHEET = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAIAAAAAQCAYAAADeWHeIAAAAOUlEQVR42u3SMREAAAjEMCz/ilHs4AMy' +
      'xECvlfTwV4lgACEMgAEwAAbAABgAA2AADIABMAAGwABctHt4mQA9DDsNAAAAAElFTkSuQmCC',
  ),
  (c) => c.charCodeAt(0),
);

export const GET: APIRoute = () =>
  new Response(SHEET, { headers: { 'content-type': 'image/png' } });
