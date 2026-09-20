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
  const held = document.getElementById(id);
  if (href === null) {
    held?.remove();
    return;
  }
  for (const origin of PRECONNECT) {
    if (document.getElementById(origin.id)) continue;
    const hint = document.createElement('link');
    hint.id = origin.id;
    hint.rel = 'preconnect';
    hint.href = origin.href;
    if (origin.anonymous) hint.crossOrigin = '';
    document.head.append(hint);
  }
  const link = held instanceof HTMLLinkElement ? held : document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  if (link.getAttribute('href') !== href) link.href = href;
  if (!link.isConnected) document.head.append(link);
}
