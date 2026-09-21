/** Shared bits of the two launcher endpoints. Neither holds state. */

/** The one path either endpoint appends to the site a caller names. */
export const launcherBase = '/internal_api/app_session_request';

/**
 * The domains a Flow Production Tracking site is served on. The corpus measures the
 * launcher (`052_app_session_launcher`) but names no hostname rule anywhere, so this
 * is the product's two domains and not a measured fact.
 */
const siteDomains = ['.shotgrid.autodesk.com', '.shotgunstudio.com'];

export function badRequest(message: string): Response {
  return Response.json({ message }, { status: 400 });
}

export function forbidden(message: string): Response {
  return Response.json({ message }, { status: 403 });
}

export function forwardFailed(error: unknown): Response {
  return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 502 });
}

/**
 * The site root to forward to, or the refusal to answer instead. Https only: the
 * session token the launcher hands back is a credential for the person who approved.
 * A host off the product's domains is refused, so this endpoint reaches the product
 * and nothing else.
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
  if (!siteDomains.some((domain) => url.hostname.endsWith(domain))) {
    return forbidden("'siteUrl' must be a Flow Production Tracking site.");
  }
  return url.origin;
}

/**
 * True when the call came from a page this site served. A browser sends `Origin` on
 * every cross-site fetch, so a page on another host cannot pass this, and a caller
 * that sends none does not either. Hosts are compared rather than origins: the
 * deployment terminates TLS at its proxy, so the request the adapter builds may be
 * http while the page is https.
 */
export function fromThisSite(request: Request, self: URL): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === self.host;
  } catch {
    return false;
  }
}
