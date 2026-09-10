/** Shared bits of the two launcher endpoints. Neither holds state. */

/** The one path either endpoint appends to the site a caller names. */
export const launcherBase = '/internal_api/app_session_request';

export function badRequest(message: string): Response {
  return Response.json({ message }, { status: 400 });
}

export function forwardFailed(error: unknown): Response {
  return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 502 });
}

/**
 * The site root to forward to, or the 400 to answer instead. Https only: the
 * session token the launcher hands back is a credential for the person who
 * approved.
 */
export function siteFromBody(value: unknown): string | Response {
  if (typeof value !== 'string' || value.trim() === '') return badRequest("'siteUrl' is required.");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return badRequest("'siteUrl' must be a URL.");
  }
  if (url.protocol !== 'https:') return badRequest("'siteUrl' must be https.");
  return url.origin;
}
