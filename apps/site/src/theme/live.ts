/** A stylesheet the page holds under one id, rewritten in place. */
export function applyStyle(id: string, css: string): void {
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = id;
    document.head.append(tag);
  }
  tag.textContent = css;
}

/** The two origins a Google Fonts stylesheet is served from, and the id each link is kept under. */
const PRECONNECT: readonly { id: string; href: string; anonymous: boolean }[] = [
  { id: 'sg-fonts-preconnect', href: 'https://fonts.googleapis.com', anonymous: false },
  { id: 'sg-fonts-preconnect-files', href: 'https://fonts.gstatic.com', anonymous: true },
];

/** A font request the page holds under one id, repointed in place; null takes it off. */
export function applyFontLink(id: string, href: string | null): void {
  // One stylesheet link per request, `id`, `id-1`, `id-2`...; a shorter list drops the tail.
  const hrefs = href === null ? [] : href.split(/\s+/).filter((one) => one.length > 0);
  for (let index = 0; ; index++) {
    const linkId = index === 0 ? id : `${id}-${index}`;
    const held = document.getElementById(linkId);
    if (index >= hrefs.length) {
      if (!held) break;
      held.remove();
      continue;
    }
    if (index === 0) {
      for (const origin of PRECONNECT) {
        if (document.getElementById(origin.id)) continue;
        const hint = document.createElement('link');
        hint.id = origin.id;
        hint.rel = 'preconnect';
        hint.href = origin.href;
        if (origin.anonymous) hint.crossOrigin = '';
        document.head.append(hint);
      }
    }
    const link = held instanceof HTMLLinkElement ? held : document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    if (link.getAttribute('href') !== hrefs[index]) link.href = hrefs[index]!;
    if (!link.isConnected) document.head.append(link);
  }
}
