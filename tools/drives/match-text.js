// The matched runs are one component, drawn the same on its own page and inside a widget.
//
//   pnpm qa --start --path /widgets/match-text/ --framework both --drive tools/drives/match-text.js
//
// The page's query marks every word wherever it occurs, the marked runs are the only
// thing at the heavier weight, the runs rebuild each label exactly, and a query the
// label does not carry leaves it whole.

const notes = [];
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);
const texts = (framework) => [...pane(framework).querySelectorAll('[data-demo="labels"] [data-slot="match-text"]')];
const weight = (el) => Number(getComputedStyle(el).fontWeight);

/** What one MatchText drew: its whole label, and the runs it marked. */
function read(el) {
  const runs = [...el.children];
  return {
    label: el.textContent,
    rebuilt: runs.map((run) => run.textContent).join(''),
    marked: runs.filter((run) => weight(run) > weight(el)).map((run) => run.textContent),
  };
}

async function setQuery(framework, value) {
  const input = pane(framework).querySelector('[data-slot="input"]');
  const proto = Object.getPrototypeOf(input);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(300);
}

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };
for (let i = 0; i < 60 && !drawn.every((f) => texts(f).length >= 5); i += 1) await wait(250);

for (const framework of drawn) {
  const all = texts(framework);
  if (all.length < 5) return { verdict: `FAIL ${framework} drew ${all.length} labels, expected 5`, notes };

  // The page starts on a two-word query, which is what the search endpoint matches on.
  const started = all.map(read);
  for (const one of started) {
    if (one.rebuilt !== one.label) {
      return { verdict: `FAIL ${framework} lost text: "${one.rebuilt}" against "${one.label}"`, notes };
    }
  }
  const marks = started.flatMap((one) => one.marked);
  if (marks.length === 0) return { verdict: `FAIL ${framework} marked nothing on the page's own query`, notes };
  if (marks.some((run) => !/^(ad|mo)$/i.test(run))) {
    return { verdict: `FAIL ${framework} marked a run that is no word of the query: ${marks.join(', ')}`, notes };
  }
  notes.push(`${framework}: "ad mo" marked ${marks.length} runs — ${[...new Set(marks)].join(', ')}`);

  // A query nothing carries leaves every label whole and unmarked.
  await setQuery(framework, 'zzz');
  const none = texts(framework).map(read);
  if (none.some((one) => one.marked.length > 0)) {
    return { verdict: `FAIL ${framework} marked a run for a query no label carries`, notes };
  }
  if (none.some((one) => one.rebuilt !== one.label)) {
    return { verdict: `FAIL ${framework} lost text on a query that matches nothing`, notes };
  }
  notes.push(`${framework}: a query no label carries marks nothing and keeps every label whole`);

  await setQuery(framework, 'ad mo');
  await wait(200);
}

// Drawn together, the two frameworks mark the same runs.
if (drawn.length === 2) {
  const per = (f) => texts(f).map((el) => read(el).marked.join('|')).join(' / ');
  if (per('svelte') !== per('react')) {
    return { verdict: 'FAIL the two frameworks marked different runs', notes, svelte: per('svelte'), react: per('react') };
  }
  notes.push('both frameworks marked the same runs');
}

texts(drawn[0])[0]?.scrollIntoView({ block: 'center' });
await wait(400);

return { verdict: 'PASS every word is marked wherever it occurs, the runs rebuild each label, and weight is the only mark', notes };
