const pause = (ms) => new Promise((r) => setTimeout(r, ms));
/** A press, the way a mouse makes one: the field opens on pointerdown. */
const press = (el) => {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
};
const island = [...document.querySelectorAll('[data-island]')].find((el) => el.offsetParent !== null);
const fw = island?.dataset.island;
const group = island?.querySelector('[data-demo="codes"]');
if (!group) return { verdict: 'FAIL no visible codes group' };
const controls = group.querySelectorAll('[data-slot$="-picker-control"]');
if (controls.length !== 2) return { verdict: `FAIL ${controls.length} controls in the codes group` };
const results = [];
for (const control of controls) {
  press(control);
  for (let t = 0; t < 30 && !document.querySelector('[data-slot$="-picker-option"]'); t++) await pause(50);
  await pause(200);
  results.push([...document.querySelectorAll('[data-slot$="-picker-code"]')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
  for (const el of [document.activeElement, control]) el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  for (let t = 0; t < 30 && document.querySelector('[data-slot$="-picker-option"]'); t++) await pause(50);
  await pause(200);
}
const ok = results[0].includes('HumanUser') && results[0].includes('Step') && results[1].length === 0;
return { verdict: (ok ? 'PASS ' : 'FAIL ') + `${fw}: with showCode ${JSON.stringify(results[0])}, without ${JSON.stringify(results[1])}` };
