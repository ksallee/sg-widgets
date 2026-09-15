// The four cases of the search-control page: a query that debounces, pages and picks,
// a list with no query at all, a read that failed, and the Escape rule the base owns.
//
//   pnpm qa --start --path /widgets/search-control/ --framework both --drive tools/drives/search-control.js

const failures = [];
const seen = {};

function type(input, text) {
  const proto = Object.getPrototypeOf(input);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter ? setter.call(input, text) : (input.value = text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}

async function until(read, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(50);
  }
}

async function drive(pane, framework) {
  const box = $('[data-demo-case="search"]', pane);
  const input = box && $('input[data-slot="command-input"]', box);
  if (!input) {
    failures.push(`${framework}: no query case to type into`);
    return null;
  }
  const options = () => $$('[data-slot="search-control-option"]', box);

  /* 1. Nothing is read before the pause elapses; the skeletons stand in meanwhile. */
  type(input, 'a');
  await wait(120);
  if (!$('[data-slot="search-loading"]', box)) failures.push(`${framework}: no skeletons while loading`);
  if (options().length !== 0) failures.push(`${framework}: rows before the debounce`);

  const rows = await until(() => (options().length > 0 ? options() : null));
  if (!rows) {
    failures.push(`${framework}: the query answered nothing`);
    return null;
  }

  /* 2. A load-more row reads the next page under the rows already there. */
  const more = $('[data-slot="search-load-more"]', box);
  if (!more) failures.push(`${framework}: a full page drew no load-more row`);
  const first = rows.length;
  let paged = first;
  if (more) {
    more.click();
    paged = (await until(() => (options().length > first ? options().length : null))) ?? options().length;
    if (paged <= first) failures.push(`${framework}: the load-more row added no rows`);
  }

  /* 3. A press takes the row. */
  const readout = () => $('[data-demo="picked"]', box).textContent.trim();
  const before = readout();
  options()[0].click();
  const picked = await until(() => (readout() !== before ? readout() : null));
  if (!picked) failures.push(`${framework}: a press on a row emitted nothing`);

  /* 4. A query that matches nothing is the empty line. */
  type(input, 'zzzzz');
  if (!(await until(() => $('[data-slot="search-empty"]', box)))) {
    failures.push(`${framework}: a query matching nothing drew no empty line`);
  }

  /* 5. The bare shell reads once, with no command box around it. */
  const bare = $('[data-demo-case="bare"]', pane);
  const listed = await until(() => {
    const found = $$('[data-slot="search-control-option"]', bare);
    return found.length > 0 ? found : null;
  });
  if (!listed) failures.push(`${framework}: the bare shell drew no rows`);
  if (bare && $('input[data-slot="command-input"]', bare)) {
    failures.push(`${framework}: the bare shell drew a search row`);
  }

  /* 6. A read that failed is the error line. */
  const broken = $('[data-demo-case="error"]', pane);
  const error = await until(() => broken && $('[data-slot="search-error"]', broken));
  if (!error) failures.push(`${framework}: the failed read drew no error line`);

  /* 7. Escape with a query clears it and the rows and keeps the caret in the box; with
        no query it is the shell's, and the inline box does nothing with it. */
  type(input, 'a');
  if (!(await until(() => options().length > 0))) failures.push(`${framework}: nothing to clear`);
  input.focus({ preventScroll: true });
  press(input, 'Escape');
  await wait(200);
  const cleared = input.value === '' && options().length === 0;
  if (!cleared) failures.push(`${framework}: Escape left "${input.value}" and ${options().length} rows`);
  if (document.activeElement !== input) failures.push(`${framework}: Escape took the caret out of the box`);
  press(input, 'Escape');
  await wait(200);
  if (input.value !== '' || options().length !== 0) {
    failures.push(`${framework}: a second Escape changed the box`);
  }

  return {
    firstPage: first,
    afterLoadMore: paged,
    escapeCleared: cleared,
    picked: picked ?? readout(),
    bareRows: listed ? listed.length : 0,
    error: error ? error.textContent.trim() : '',
  };
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  seen[framework] = await drive(pane, framework);
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$('[data-demo-case="search"]')?.scrollIntoView({ block: 'center' });
await wait(200);

return {
  verdict:
    failures.length === 0
      ? 'PASS the base debounced, paged, picked, emptied, cleared on Escape, listed without a query and reported a failed read'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
