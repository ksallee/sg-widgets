/**
 * The map of the site for a client that fetches rather than reads.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsTxt, pagesFrom } from './_llms';

export const prerender = true;

export const GET: APIRoute = async ({ site }) =>
  new Response(llmsTxt(pagesFrom(await getCollection('docs')), site), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
