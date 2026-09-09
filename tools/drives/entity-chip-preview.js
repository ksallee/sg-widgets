// The three variants, the detail links, and the hover card opening on a chip.
const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);

function hover(el) {
  const box = el.getBoundingClientRect();
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
    pointerType: 'mouse',
    pointerId: 1,
    isPrimary: true,
  };
  for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) {
    el.dispatchEvent(new (type.startsWith('pointer') ? PointerEvent : MouseEvent)(type, init));
  }
}

const triggers = () => [...document.querySelectorAll('[data-slot="entity-chip-preview"]')];
for (let i = 0; i < 60 && triggers().length < 2; i += 1) await wait(250);
if (triggers().length < 2) return { verdict: 'FAIL neither framework drew a chip with a preview' };

for (const framework of ['svelte', 'react']) {
  const variants = new Set([...pane(framework).querySelectorAll('[data-slot="entity-chip"]')].map((el) => el.dataset.variant));
  notes.push(`${framework}: variants ${[...variants].join(', ')}`);
  for (const variant of ['chip', 'link', 'text']) {
    if (!variants.has(variant)) return { verdict: `FAIL ${framework} drew no ${variant} variant`, notes };
  }
  const detail = [...pane(framework).querySelectorAll('[data-slot="entity-chip"] a[target="_blank"]')].map((a) => a.getAttribute('href'));
  if (!detail.some((href) => href.includes('/detail/'))) {
    return { verdict: `FAIL ${framework} addressed no row on a site`, notes };
  }
  notes.push(`${framework}: links to ${detail[0]}`);

  const trigger = pane(framework).querySelector('[data-slot="entity-chip-preview"]');
  hover(trigger);
}

// The card mounts on open and reads then, so the fields arrive after the surface does.
const rows = () => [...document.querySelectorAll('[data-slot="hover-card-content"] dt')];
for (let i = 0; i < 60 && rows().length < 6; i += 1) await wait(250);

const opened = [...document.querySelectorAll('[data-slot="hover-card-content"] [data-slot="entity-card"]')];
if (opened.length < 2) return { verdict: `FAIL ${opened.length} hover cards opened, expected 2`, notes };

const shown = [...new Set(rows().map((el) => el.textContent.trim()))];
notes.push(`hover card fields: ${shown.join(' | ')}`);
if (shown.length !== 3) return { verdict: `FAIL the hover card shows ${shown.length} fields, expected 3`, notes };

return { verdict: 'PASS three variants, detail links, and a hover card per framework', notes };
