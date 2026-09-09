import { useState } from 'react';
import type { EntityRef } from '@sg-widgets/core';
import { UserMultiPicker, UserPicker } from '@/registry/sg/components/user-picker';
import { getDemoClient } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const field = 'flex max-w-sm flex-col gap-2';

const preset: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };
const SIZES = ['sm', 'md', 'lg'] as const;

export default function UserPickerDemo() {
  const client = getDemoClient();

  const [one, setOne] = useState<EntityRef | null>(null);
  const [people, setPeople] = useState<EntityRef[]>([]);
  const [peopleOnly, setPeopleOnly] = useState<EntityRef | null>(null);
  const [withInactive, setWithInactive] = useState<EntityRef | null>(null);
  // A bare reference: type and id, no name. Resolved on mount.
  const [bare, setBare] = useState<EntityRef[]>([{ type: 'HumanUser', id: 22 }]);

  return (
    <div className="flex flex-col gap-4">
      <section className={group} data-demo-case="single">
        <h4 className={label}>One person or script</h4>
        <div className={field}>
          <UserPicker client={client} value={one} onValueChange={setOne} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="multi">
        <h4 className={label}>Several, with checkbox rows</h4>
        <div className={field}>
          <UserMultiPicker client={client} value={people} onValueChange={setPeople} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="people-only">
        <h4 className={label}>People only</h4>
        <div className={field}>
          <UserPicker client={client} includeApiUsers={false} value={peopleOnly} onValueChange={setPeopleOnly} />
        </div>
      </section>

      <section className={group} data-demo-case="inactive">
        <h4 className={label}>Inactive people included</h4>
        <div className={field}>
          <UserPicker client={client} includeInactive value={withInactive} onValueChange={setWithInactive} />
        </div>
      </section>

      <section className={group} data-demo-case="hydrate">
        <h4 className={label}>Bare reference, resolved on mount</h4>
        <div className={field}>
          <UserMultiPicker client={client} value={bare} onValueChange={setBare} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Sizes, then disabled, read-only, invalid</h4>
        <div className="flex flex-col gap-2">
          {SIZES.map((size) => (
            <div className={field} key={size}>
              <UserPicker client={client} value={preset} size={size} />
            </div>
          ))}
          <div className={field}>
            <UserPicker client={client} value={preset} disabled />
          </div>
          <div className={field}>
            <UserPicker client={client} value={preset} readOnly />
          </div>
          <div className={field}>
            <UserPicker client={client} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
