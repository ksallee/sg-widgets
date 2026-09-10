// Open the context popover, read its three sections, and pick an assigned task.
const notes = [];
const fail = (m) => { notes.push('FAIL ' + m); return { verdict: 'FAIL ' + m, notes }; };

function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}
async function until(fn, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

const popovers = () => $$('[data-slot="popover-content"]');

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) return fail(`no ${framework} pane`);
  const readout = () => $('[data-demo="context"]', pane).textContent.trim();
  const before = readout();

  const trigger = $('[data-slot="context-selector-trigger"]', pane);
  const triggerChips = $$('[data-slot="entity-chip"]', trigger).map((c) => c.dataset.entityType);
  if (triggerChips.join(' ') !== 'Project Shot Task') {
    return fail(`${framework}: trigger chips are ${triggerChips.join(' ')}`);
  }

  trigger.click();
  const popover = await until(() => popovers()[0]);
  if (!popover) return fail(`${framework}: the popover did not open`);

  /* The three sections. */
  for (const slot of ['context-recents', 'context-my-tasks', 'context-hierarchy']) {
    if (!popover.querySelector(`[data-slot="${slot}"]`)) return fail(`${framework}: no ${slot} section`);
  }
  const recents = $$('[data-slot="context-recents"] button', popover);
  if (recents.length !== 2) return fail(`${framework}: ${recents.length} recents, wanted 2`);

  const tasks = await until(() => {
    const rows = $$('[data-slot="context-my-tasks"] button[data-entity-type="Task"]', popover);
    return rows.length ? rows : null;
  });
  if (!tasks) return fail(`${framework}: no assigned tasks`);
  const projects = $$('[data-slot="context-my-tasks"] h5', popover).map((h) => h.textContent.trim());
  if (projects.length === 0) return fail(`${framework}: assigned tasks are not grouped by project`);
  // The secondary's data type is a schema read, so the badges land after the rows.
  const badges =
    (await until(() => {
      const found = $$('[data-slot="context-my-tasks"] [data-slot="status-badge"]', popover);
      return found.length === tasks.length ? found : null;
    })) ?? $$('[data-slot="context-my-tasks"] [data-slot="status-badge"]', popover);
  if (badges.length !== tasks.length) return fail(`${framework}: ${badges.length} badges for ${tasks.length} tasks`);
  const steps = tasks
    .map((t) => t.querySelector('[data-slot="picker-row-sub-label"]')?.textContent.trim())
    .filter(Boolean);
  if (steps.length !== tasks.length) return fail(`${framework}: a task row has no step line`);
  if (!$('[data-slot="hierarchical-search"]', popover)) return fail(`${framework}: no tree in the popover`);

  /* Picking an assigned task sets all three parts at once. */
  tasks[0].click();
  const after = await until(() => (readout() !== before ? readout() : null));
  if (!after) return fail(`${framework}: picking a task changed nothing`);
  if (popovers().length !== 0) return fail(`${framework}: the popover stayed open`);
  if (after.includes('project - ') || after.includes('task -')) return fail(`${framework}: partial context "${after}"`);
  notes.push(`${framework}: ${recents.length} recents, ${tasks.length} tasks in ${projects.length} project group(s) (${projects.join(', ')}), ${badges.length} status badges; picked -> ${after}`);

  /* Escape closes it again. */
  trigger.click();
  if (!(await until(() => popovers().length === 1))) return fail(`${framework}: the popover did not reopen`);
  press(document.activeElement ?? document.body, 'Escape');
  if (!(await until(() => popovers().length === 0))) return fail(`${framework}: Escape did not close the popover`);
}

return { verdict: 'PASS three sections, grouped tasks with status, context emitted in both frameworks', notes };
