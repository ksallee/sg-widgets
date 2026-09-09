// Live mode: the table's rows come from the project the toolbar picked.
//
//   pnpm qa --start --live --project 70 --path /widgets/entity-table/ --drive tools/drives/live-entity-table.js
//
// Every mock Version code is one of its two projects' shot codes with a step and a
// revision appended, so a code outside that shape is the site's.
const MOCK_CODE = /^(sh0|hb0)\d+_/;

const source = $('[data-sg-demo]')?.dataset.source;
if (source !== 'live') return { verdict: `FAIL the toolbar is in ${source} mode, not live` };

const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const rows = () => [...pane().querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')];
const codes = () => rows().map((r) => r.querySelector('td[data-column="code"]')?.textContent.trim() ?? '');

for (let i = 0; i < 80 && rows().length === 0; i += 1) await wait(250);
await wait(600);

const shown = codes();
const project = JSON.parse(localStorage.getItem('sg-demo:project') ?? 'null');
const fromSite = shown.filter((code) => code && !MOCK_CODE.test(code));

if (shown.length === 0) return { verdict: 'FAIL the table rendered no rows', project };
if (fromSite.length === 0) {
  return { verdict: 'FAIL every code on screen has the mock shape', project, codes: shown.slice(0, 5) };
}

return {
  verdict: `PASS ${shown.length} rows on screen, from project ${project?.id}`,
  project,
  codes: shown.slice(0, 5),
};
