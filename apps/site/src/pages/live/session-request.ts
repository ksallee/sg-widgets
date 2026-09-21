/**
 * Step one of the App Session Launcher, forwarded.
 *
 * `/api/v1` answers an OPTIONS preflight with the request origin echoed and
 * credentials allowed, so the browser calls the REST API itself. The launcher
 * lives outside `/api/v1` and answers no CORS headers at all (probe 062), so its
 * two calls are the only ones that need a server. This endpoint appends the one fixed
 * launcher path to the site the caller names, forwards `appName` and
 * `machineId`, and answers `{id, url}` (post_internal_api_app_session_request).
 * It takes no credential, keeps nothing, and reads nothing of this site's. It
 * forwards for a page this site served, to a site on the product's domains, and
 * answers 403 to anything else.
 */
import type { APIRoute } from 'astro';
import { badRequest, forbidden, forwardFailed, fromThisSite, launcherBase, siteFromBody } from './_launcher';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  if (!fromThisSite(request, url)) return forbidden('This endpoint answers this site only.');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be a JSON object.');
  }
  const fields = (body ?? {}) as { siteUrl?: unknown; appName?: unknown; machineId?: unknown };
  const site = siteFromBody(fields.siteUrl);
  if (typeof site !== 'string') return site;
  const appName = typeof fields.appName === 'string' && fields.appName ? fields.appName : 'sg-widgets docs';
  const machineId = typeof fields.machineId === 'string' && fields.machineId ? fields.machineId : 'sg-widgets-docs';

  let res: Response;
  try {
    res = await fetch(`${site}${launcherBase}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ appName, machineId }).toString(),
    });
  } catch (error) {
    return forwardFailed(error);
  }

  const text = await res.text();
  let answer: { sessionRequestId?: string; url?: string; message?: string } | null = null;
  try {
    answer = text ? JSON.parse(text) : null;
  } catch {
    answer = null;
  }
  // The launcher answers `{"message": ...}`, never the `errors[]` envelope of `/api/v1`.
  if (!res.ok || !answer?.sessionRequestId || !answer.url) {
    return Response.json(
      { message: answer?.message ?? 'The site did not return a session request.' },
      { status: res.ok ? 502 : res.status },
    );
  }
  return Response.json({ id: answer.sessionRequestId, url: answer.url });
};
