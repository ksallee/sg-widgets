/**
 * `astro:content` over the files on disk, so an endpoint can be called in a test.
 *
 * Returns what the endpoints read of a collection entry -- the slug, the frontmatter
 * title and description, and the body after the frontmatter -- with the ids Starlight's
 * loader gives: a directory's `index` page is the directory.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = fileURLToPath(new URL('../../src/content/docs/', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? files(join(dir, item.name))
      : item.name.endsWith('.mdx') || item.name.endsWith('.md')
        ? [join(dir, item.name)]
        : [],
  );
}

/** The value of a top-level frontmatter key, unquoted. */
function field(frontmatter: string, key: string): string | undefined {
  const found = frontmatter.match(new RegExp(`^${key}: *(.*)$`, 'm'));
  return found?.[1]?.trim().replace(/^['"]|['"]$/g, '');
}

export async function getCollection(name: string) {
  if (name !== 'docs') throw new Error(`[stub] no collection named ${name}`);
  return files(docs).map((path) => {
    const text = readFileSync(path, 'utf8');
    const end = text.indexOf('\n---', 4);
    const frontmatter = text.slice(4, end);
    const id = relative(docs, path)
      .replace(/\.mdx?$/, '')
      .replace(/(^|\/)index$/, '');
    return {
      id,
      body: text.slice(end + 4).replace(/^\n/, ''),
      data: { title: field(frontmatter, 'title') ?? id, description: field(frontmatter, 'description') },
    };
  });
}
