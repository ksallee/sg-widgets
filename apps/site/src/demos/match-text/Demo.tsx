import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { MatchText } from '@/registry/sg/components/match-text';

/** Labels of the shape a text search answers: a name, a path, a person. */
const LABELS = [
  'sh010_0030_characterfx_v006',
  'Ada Lovelace',
  'Blue Moon Rising / Sequence sq020 / sh020_0050',
  'propCrate_model_v002',
  'anna.van.der.meer@example.com',
];

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

export default function MatchTextDemo() {
  const [query, setQuery] = useState('ad mo');

  return (
    <div className="flex flex-col gap-4">
      <section className={group}>
        <h4 className={label}>Query</h4>
        <Input
          aria-label="Query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-64"
        />
      </section>

      <section className={group}>
        <h4 className={label}>Every word, wherever it occurs</h4>
        <ul data-demo="labels" className="flex flex-col gap-1.5 text-sm">
          {LABELS.map((text) => (
            <li key={text} className="min-w-0 truncate">
              <MatchText text={text} query={query} />
            </li>
          ))}
        </ul>
      </section>

      <section className={group}>
        <h4 className={label}>In a muted line, where weight is the only mark</h4>
        <p className="text-muted-foreground text-xs">
          <MatchText text="Review submission for sh010_0030, waiting on Ada" query={query} />
        </p>
      </section>
    </div>
  );
}
