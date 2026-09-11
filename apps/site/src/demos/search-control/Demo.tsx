import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { hasMorePage, matchesEveryWord } from '@sg-widgets/core';
import { CommandItem } from '@/components/ui/command';
import type { SearchAnswer, SearchRequest } from '@/registry/sg/components/search-control';
import { SearchControl } from '@/registry/sg/components/search-control';

/** One crew member, which is all a row of this demo holds. */
interface Member {
  id: string;
  name: string;
  department: string;
}

/** The set every read here answers from. A wrapper's own read is all it adds. */
const CREW: Member[] = [
  { id: 'avdm', name: 'Anna van der Meer', department: 'Layout' },
  { id: 'poos', name: 'Piet Oosterhuis', department: 'Animation' },
  { id: 'mhal', name: 'Mira Halloran', department: 'Lighting' },
  { id: 'tber', name: 'Tomas Bergqvist', department: 'Compositing' },
  { id: 'inak', name: 'Iris Nakamura', department: 'Effects' },
  { id: 'rcha', name: 'Ravi Chandrasekar', department: 'Matchmove' },
  { id: 'edua', name: 'Elena Duarte', department: 'Rigging' },
  { id: 'jkle', name: 'Jonas Klein', department: 'Editorial' },
  { id: 'nokb', name: 'Nora Okonjo', department: 'Layout' },
  { id: 'sfer', name: 'Sofia Ferreira', department: 'Animation' },
  { id: 'lmar', name: 'Luca Marchetti', department: 'Lighting' },
  { id: 'yhas', name: 'Yuki Hasegawa', department: 'Compositing' },
];

/** The page this demo reads at, small enough that a load-more row is always there. */
const PAGE = 4;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One page of the crew matching every word of the query. */
async function find({ query, page }: SearchRequest): Promise<SearchAnswer<Member>> {
  await pause(300);
  const matched = CREW.filter((member) => matchesEveryWord(`${member.name} ${member.department}`, query));
  const from = (page - 1) * PAGE;
  const items = matched.slice(from, from + PAGE);
  return { items, hasMore: hasMorePage(items.length, PAGE) && from + PAGE < matched.length };
}

/** The whole crew, in one read, for a list that takes no query. */
async function everyone(): Promise<SearchAnswer<Member>> {
  await pause(300);
  return { items: CREW.slice(0, 4) };
}

async function fails(): Promise<SearchAnswer<Member>> {
  await pause(300);
  throw new Error('The crew list is not answering.');
}

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-sm';
const box = 'border-border flex flex-col rounded-lg border p-1';

function member(item: Member): ReactNode {
  return (
    <>
      <span className="min-w-0 flex-1 truncate" title={item.name}>
        {item.name}
      </span>
      <span className="text-muted-foreground shrink-0 text-xs">{item.department}</span>
    </>
  );
}

const memberKey = (item: Member): string => item.id;

export default function SearchControlDemo() {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('Nothing yet');

  const found = useCallback(
    ({ items }: { items: Member[] }) =>
      items.map((item) => (
        <CommandItem
          key={item.id}
          value={item.id}
          data-slot="search-control-option"
          onSelect={() => setPicked(item.name)}
        >
          {member(item)}
        </CommandItem>
      )),
    [],
  );

  const listed = useCallback(
    ({ items }: { items: Member[] }) =>
      items.map((item) => (
        <div key={item.id} data-slot="search-control-option" className={row}>
          {member(item)}
        </div>
      )),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <section className={group} data-demo-case="search">
        <h4 className={label}>A query, debounced, paged and picked</h4>
        <SearchControl<Member>
          load={find}
          query={query}
          onQueryChange={setQuery}
          commandClass="border-border rounded-lg border"
          placeholder="Search the crew…"
          emptyLabel="No one by that name"
          keyOf={memberKey}
          paging
          rows={found}
        />
        <p className="text-muted-foreground font-mono text-xs" data-demo="picked">
          {picked}
        </p>
      </section>

      <section className={group} data-demo-case="bare">
        <h4 className={label}>No query: one read, the same list</h4>
        <div className={box}>
          <SearchControl<Member> load={everyone} shell="bare" readsEmpty skeletonLines={2} rows={listed} />
        </div>
      </section>

      <section className={group} data-demo-case="error">
        <h4 className={label}>A read that failed</h4>
        <div className={box}>
          <SearchControl<Member> load={fails} shell="bare" readsEmpty skeletonLines={2} rows={listed} />
        </div>
      </section>
    </div>
  );
}
