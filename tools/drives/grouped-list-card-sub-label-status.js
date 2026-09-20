// Read the sub-label a grouped list row and an entity card tile draw from a bare
// status path: it reads the name the site gives the code, never the code itself.
//
//   pnpm qa --start --path /widgets/grouped-list/ --framework both --drive tools/drives/grouped-list-card-sub-label-status.js
//   pnpm qa --start --path /widgets/entity-card/ --framework both --drive tools/drives/grouped-list-card-sub-label-status.js

/** What the mock's Status table calls each of Version's codes. */
const DISPLAY = {
  na: 'N/A', rev: 'Pending Review', vwd: 'Viewed', apr: 'Approved', custom: 'CustomIcon',
  fin: 'Final', ip: 'In Progress', clsd: 'Closed', cmpt: 'Complete', cfrm: 'Confirmed',
  pndad: 'Pending Art Director', pndl: 'Pending Lead', pndvs: 'Pending VFX Supervisor',
  part: 'partial', pass: 'pass', pndng: 'Pending',
};
const NAMES = new Set(Object.values(DISPLAY));
/** The codes the site names differently, so one reaching a sub-label shows. */
const RAW = new Set(Object.keys(DISPLAY).filter((code) => DISPLAY[code] !== code));

const card = location.pathname.includes('entity-card');
const what = card ? 'tile' : 'row';
/** The sub-label of every element the status path was named on, in one pane. */
const SUB = card
  ? '[data-slot="entity-card"][data-variant="tile"] [data-slot="entity-card-sub"]'
  : '[data-demo-case="derived"] [data-slot="grouped-list-row-sub-label"]';

const failures = [];
const seen = {};

async function until(read, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(100);
  }
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  const subLabels = () =>
    $$(SUB, pane)
      .map((el) => el.textContent.trim())
      .filter((text) => text.length > 0);
  if (!(await until(() => subLabels().length > 0))) {
    failures.push(`${framework}: no ${what} carried a sub-label`);
    continue;
  }
  // The rows land a page at a time, so read once they have settled.
  await wait(500);

  const texts = subLabels();
  const codes = texts.filter((text) => RAW.has(text));
  const strangers = texts.filter((text) => !NAMES.has(text));
  if (codes.length > 0) {
    failures.push(`${framework}: ${codes.length} sub-labels read a code, ${JSON.stringify([...new Set(codes)])}`);
  }
  if (strangers.length > 0) {
    failures.push(`${framework}: sub-labels no status is called, ${JSON.stringify([...new Set(strangers)])}`);
  }
  seen[framework] = { [what]: texts.length, names: [...new Set(texts)].sort() };
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? `PASS every ${what} sub-label reads a status name, ${JSON.stringify(
          [...new Set(Object.values(seen).flatMap((pane) => pane.names))].sort(),
        )}`
      : `FAIL ${failures.join('; ')}`,
  seen,
};
