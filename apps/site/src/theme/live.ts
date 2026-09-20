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
