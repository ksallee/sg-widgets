/**
 * The map, then the prose of every page, as Markdown.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsFullTxt, pagesFrom } from './_llms';

export const prerender = true;

export const GET: APIRoute = async ({ site }) =>
  new Response(llmsFullTxt(pagesFrom(await getCollection('docs')), site), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
