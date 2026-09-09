# Writing rules

For docs pages, READMEs, PR bodies, issue descriptions and code comments.

## Documentation

- Written for the person using the widget. It says what the widget does, what it takes, what it
  emits, and how to install it. Nothing about how it was built, tested or mocked.
- Declarative and short. One idea per sentence. No adjectives that sell ("powerful", "beautiful",
  "seamless"). No "simply", "just", "easily".
- Every widget page has, in this order: one sentence saying what it is, install commands for both
  frameworks, a live demo, a props table (name, type, default, one-line meaning), events, slots, a
  keyboard table, and any API behaviour the widget relies on with its corpus citation.
- Prose names a file, prop or function only when the reader has to go there. Code goes in a fenced
  block, never inline in a sentence.
- No headers in a page under 300 words. At most three levels anywhere.

## Code comments

Terse and declarative. The code says what it is; comments do not narrate how it got there.

- A doc comment is one short sentence saying what the thing does. A parameter gets a phrase only
  when its name does not already say it. Three or four more sentences are the exception, for
  behaviour that is genuinely not self-evident.
- Comments appear only where the code alone is hard to follow, and state the rule or the
  constraint, never its discovery.
- No history. No dates, no "used to", no past bugs, no PR or issue numbers, no first person.
- Corpus citations stay (`probe 009`, `field_types/status_list`). They are the only reason this repo
  may claim anything about the API.
- A measured fact the code cannot show survives as one declarative line.

## Issues and PRs

- Issue description: what it is, in one paragraph. Edited in place when scope changes.
- PR body: what landed, what to look at, one screenshot per framework when UI changed, and
  `Closes #n`. No process narrative.
