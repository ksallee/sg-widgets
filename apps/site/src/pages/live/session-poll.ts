/**
 * Step two of the App Session Launcher, forwarded.
 *
 * The PUT the browser polls while a person approves the request. The launcher's
 * body is passed through as it is: `{"approved": false}` while pending, once
 * `{"approved": true, "sessionToken", "userLogin"}`, then 404 for a request that
 * was spent, denied, forgotten or never existed
 * (put_internal_api_app_session_request_id). The token crosses this endpoint and
 * is not written down anywhere on the way. It polls for a page this site served,
 * a site on the product's domains, and answers 403 to anything else.
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
  const fields = (body ?? {}) as { siteUrl?: unknown; id?: unknown };
  const site = siteFromBody(fields.siteUrl);
  if (typeof site !== 'string') return site;
  // The id goes in a path segment, so it may not carry one of its own.
  if (typeof fields.id !== 'string' || !/^[\w-]+$/.test(fields.id)) return badRequest("'id' is required.");

  let res: Response;
  try {
    res = await fetch(`${site}${launcherBase}/${fields.id}`, { method: 'PUT', headers: { Accept: 'application/json' } });
  } catch (error) {
    return forwardFailed(error);
  }

  const text = await res.text();
  let answer: unknown = null;
  try {
    answer = text ? JSON.parse(text) : null;
  } catch {
    answer = { message: 'The site answered a body that is not JSON.' };
  }
  return Response.json(answer, { status: res.status });
};
