/*
 * The palette, the radius and the framework on `:root`, before the first paint.
 *
 * Starlight's chrome reads the shadcn tokens through `--sl-*`, and the tokens follow
 * `data-sg-palette` and `data-sg-radius`. `demo-prefs.ts` writes all three from then on;
 * this copy runs inline in the head, beside Starlight's own theme script, so a reload
 * lands on the stored palette instead of flashing the default one.
 *
 * A name themes.css does not know matches no block and leaves the page on the tokens
 * global.css sets, which are the default palette's, so the value is filtered for shape
 * rather than against the list of palettes and a browser holding a name the list has
 * dropped paints what `demo-prefs.ts` will then resolve it to. The keys hold raw strings,
 * except when tools/qa.mjs writes them as JSON, so a quoted value reads as the string
 * inside -- the rule `demo-prefs.ts` follows.
 */
(() => {
  const read = (key, fallback) => {
    let raw = null;
    try {
      raw = localStorage.getItem('sg-demo:' + key);
    } catch {
      return fallback;
    }
    if (raw === null) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') raw = parsed;
    } catch {
      /* A raw string is the common spelling; keep it. */
    }
    return /^[a-z]+$/.test(raw) ? raw : fallback;
  };

  const root = document.documentElement;
  root.dataset.sgPalette = read('palette', 'default');
  root.dataset.sgRadius = read('radius', 'default');
  // The install tabs show the pane this names. `both` is the two-pane stage
  // `PUBLIC_SG_DEMO_BOTH` gates and is never the value a page opens on, so it resolves
  // here rather than painting a column width the build may not allow.
  root.dataset.sgFramework = read('framework', 'react') === 'svelte' ? 'svelte' : 'react';

  /*
   * The theme saved on /themes, as the `custom` palette. The stored value carries the
   * block themes.css would hold, written for that name, so the page wears it from the
   * first paint the way it wears a shipped palette.
   */
  try {
    const stored = localStorage.getItem('sg-theme:custom');
    const css = stored ? JSON.parse(stored).css : null;
    if (typeof css === 'string') {
      const tag = document.createElement('style');
      tag.id = 'sg-custom-palette';
      tag.textContent = css;
      document.head.appendChild(tag);
    }
  } catch {
    /* Blocked storage or a value this version cannot read: the page wears a shipped palette. */
  }
})();
