const island = [...document.querySelectorAll('[data-island]')].find((el) => el.offsetParent !== null);
const h = [...island.querySelectorAll('h4')].find((el) => el.textContent.trim().startsWith('Every status ticked'));
h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
await new Promise((r) => setTimeout(r, 800));
const pill = h.parentElement.querySelector('[data-slot="filter-pill-values"]');
const box = pill.getBoundingClientRect();
const badges = [...pill.querySelectorAll('[data-slot="status-badge"]')].map((b) => {
  const r = b.getBoundingClientRect();
  const label = b.querySelector('span:not([aria-hidden])') ?? b;
  return { text: b.textContent.trim(), w: Math.round(r.width), clipped: b.scrollWidth > b.clientWidth + 1, visible: r.top >= box.top - 1 && r.bottom <= box.bottom + 1 };
});
const shown = badges.filter((b) => b.visible);
const ok = badges.every((b) => !b.clipped && b.w >= 40) && shown.length >= 2 && shown.length < badges.length && box.width <= 257 && box.height <= 33;
return { verdict: (ok ? 'PASS ' : 'FAIL ') + `${island.dataset.island}: ${shown.length} whole badges of ${badges.length} in ${Math.round(box.width)}x${Math.round(box.height)}px, none clipped: ${badges.map((b) => `${b.text} ${b.w}px${b.visible ? '' : ' (hidden)'}`).join(', ')}` };
