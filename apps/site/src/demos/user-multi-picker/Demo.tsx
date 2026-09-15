import { useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { UserMultiPicker } from '@/registry/sg/components/user-multi-picker';
import { getDemoContext } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
// One control per row, full width of the pane, its caption on the line above.
const field = 'flex w-full flex-col gap-2';
const stack = 'flex flex-col gap-4';
const caption = 'text-muted-foreground text-xs';
/** At most 20rem, so the fit has something to cut against. */
const narrow = 'max-w-80';

const preset: EntityRef[] = [
  { type: 'HumanUser', id: 20, name: 'Ada Lovelace' },
  { type: 'HumanUser', id: 22, name: 'Cleo Dias' },
];
/** Five, so `ellipsis` has something to count and `max` something to cut. */
const five: EntityRef[] = [
  ...preset,
  { type: 'HumanUser', id: 23, name: 'Dmitri Ivanov' },
  { type: 'HumanUser', id: 25, name: 'Farid Nasser' },
  { type: 'HumanUser', id: 26, name: 'Grace Ono' },
];
const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

export default function UserMultiPickerDemo() {
  const context = getDemoContext();

  const [people, setPeople] = useState<EntityRef[]>([]);
  const [peopleOnly, setPeopleOnly] = useState<EntityRef[]>([]);
  /** A token field with chips already in it, for the keyboard. */
  const [tokens, setTokens] = useState<EntityRef[]>([
    { type: 'HumanUser', id: 20, name: 'Ada Lovelace' },
    { type: 'HumanUser', id: 22, name: 'Cleo Dias' },
    { type: 'HumanUser', id: 23, name: 'Dmitri Ivanov' },
  ]);
  // Bare references: type and id, no name. Resolved on mount.
  const [bare, setBare] = useState<EntityRef[]>([
    { type: 'HumanUser', id: 22 },
    { type: 'HumanUser', id: 25 },
  ]);
  /** One value per summary demo, so every control on the page takes an edit. */
  const [shown, setShown] = useState<Record<string, EntityRef[]>>({});
  const shownAt = (at: string) => shown[at] ?? five;
  const showAt = (at: string, next: EntityRef[]) => setShown((held) => ({ ...held, [at]: next }));

  return (
    <div className="flex flex-col gap-3">
      <section className={group} data-demo-case="multi">
        <h4 className={label}>Several people or scripts</h4>
        <div className={field}>
          <span className={caption}>Several people at once</span>
          <UserMultiPicker context={context} value={people} onValueChange={setPeople} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="tokens">
        <h4 className={label}>A token field: Backspace walks the chips</h4>
        <div className={field}>
          <span className={caption}>Three people already chosen</span>
          <UserMultiPicker context={context} summary="chips" value={tokens} onValueChange={setTokens} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="people-only">
        <h4 className={label}>People only, inactive included</h4>
        <div className={field}>
          <span className={caption}>No script users, and people whose status is dis</span>
          <UserMultiPicker
            context={context}
            includeApiUsers={false}
            includeInactive
            value={peopleOnly}
            onValueChange={setPeopleOnly}
          />
        </div>
      </section>

      <section className={group} data-demo-case="hydrate">
        <h4 className={label}>Bare references, resolved on mount</h4>
        <div className={field}>
          <span className={caption}>Types and ids in, names resolved on mount</span>
          <UserMultiPicker context={context} value={bare} onValueChange={setBare} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="summary">
        <h4 className={label}>What the control shows for five selected, wide and narrow</h4>
        <div className={stack}>
          {SUMMARIES.map((summary) => (
            <div className={stack} key={summary}>
              <div className={field} data-demo-summary={summary}>
                <span className={caption}>{summary}, full width</span>
                <UserMultiPicker
                  context={context}
                  value={shownAt(summary)}
                  onValueChange={(next) => showAt(summary, next)}
                  summary={summary}
                  clearable={false}
                />
              </div>
              <div className={field} data-demo-summary={`${summary}-narrow`}>
                <span className={caption}>{summary}, at most 20rem</span>
                <div className={narrow}>
                  <UserMultiPicker
                    context={context}
                    value={shownAt(`${summary}-narrow`)}
                    onValueChange={(next) => showAt(`${summary}-narrow`, next)}
                    summary={summary}
                    clearable={false}
                  />
                </div>
              </div>
            </div>
          ))}
          <div className={field} data-demo-summary="max">
            <span className={caption}>chips, two at most</span>
            <UserMultiPicker
              context={context}
              value={shownAt('max')}
              onValueChange={(next) => showAt('max', next)}
              summary="chips"
              max={2}
              clearable={false}
            />
          </div>
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Sizes, then disabled, read-only, invalid</h4>
        <div className={stack}>
          {SIZES.map((size) => (
            <div className={field} key={size}>
              <span className={caption}>{size}</span>
              <UserMultiPicker context={context} value={preset} size={size} clearable />
            </div>
          ))}
          <div className={field}>
            <span className={caption}>Disabled</span>
            <UserMultiPicker context={context} value={preset} disabled />
          </div>
          <div className={field}>
            <span className={caption}>Read-only</span>
            <UserMultiPicker context={context} value={preset} readonly />
          </div>
          <div className={field}>
            <span className={caption}>Invalid</span>
            <UserMultiPicker context={context} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
