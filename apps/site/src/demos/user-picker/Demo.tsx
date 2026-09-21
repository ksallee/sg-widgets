import { useState } from 'react';
import type { EntityRef } from 'sg-widgets-core';
import { UserPicker } from '@/registry/sg/components/user-picker';
import { getDemoContext } from '../_shared/client';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
// One control per row, full width of the pane, its caption on the line above.
const field = 'flex w-full flex-col gap-2';
const stack = 'flex flex-col gap-4';
const caption = 'text-muted-foreground text-xs';

const preset: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };
const SIZES = [
  { size: 'sm', caption: 'Small' },
  { size: 'md', caption: 'Medium, the default' },
  { size: 'lg', caption: 'Large' },
] as const;

export default function UserPickerDemo() {
  const context = getDemoContext();

  const [one, setOne] = useState<EntityRef | null>(null);
  const [byAddress, setByAddress] = useState<EntityRef | null>(null);
  const [peopleOnly, setPeopleOnly] = useState<EntityRef | null>(null);
  const [withInactive, setWithInactive] = useState<EntityRef | null>(null);
  // A bare reference: type and id, no name. Resolved on mount.
  const [bare, setBare] = useState<EntityRef | null>({ type: 'HumanUser', id: 22 });

  return (
    <div className="flex flex-col gap-3">
      <section className={group} data-demo-case="single">
        <h4 className={label}>One person or script</h4>
        <div className={field}>
          <span className={caption}>One person or script, clearable</span>
          <UserPicker context={context} value={one} onValueChange={setOne} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="by-address">
        <h4 className={label}>Matched on the name, the address or the login</h4>
        <div className={field}>
          <span className={caption}>Matched on the name, the address or the login</span>
          <UserPicker
            context={context}
            value={byAddress}
            onValueChange={setByAddress}
            placeholder="Try ada, ada.lo or @example.studio…"
          />
        </div>
      </section>

      <section className={group} data-demo-case="people-only">
        <h4 className={label}>People only</h4>
        <div className={field}>
          <span className={caption}>People only, no script users</span>
          <UserPicker context={context} includeApiUsers={false} value={peopleOnly} onValueChange={setPeopleOnly} />
        </div>
      </section>

      <section className={group} data-demo-case="inactive">
        <h4 className={label}>Inactive people included</h4>
        <div className={field}>
          <span className={caption}>Inactive people included</span>
          <UserPicker context={context} includeInactive value={withInactive} onValueChange={setWithInactive} />
        </div>
      </section>

      <section className={group} data-demo-case="hydrate">
        <h4 className={label}>Bare reference, resolved on mount</h4>
        <div className={field}>
          <span className={caption}>Type and id in, name resolved on mount</span>
          <UserPicker context={context} value={bare} onValueChange={setBare} clearable />
        </div>
      </section>

      <section className={group} data-demo-case="states">
        <h4 className={label}>Sizes, then disabled, read-only, invalid</h4>
        <div className={stack}>
          {SIZES.map(({ size, caption: sizeCaption }) => (
            <div className={field} key={size}>
              <span className={caption}>{sizeCaption}</span>
              <UserPicker context={context} value={preset} size={size} />
            </div>
          ))}
          <div className={field}>
            <span className={caption}>Disabled</span>
            <UserPicker context={context} value={preset} disabled />
          </div>
          <div className={field}>
            <span className={caption}>Read-only</span>
            <UserPicker context={context} value={preset} readonly />
          </div>
          <div className={field}>
            <span className={caption}>Invalid</span>
            <UserPicker context={context} value={preset} invalid />
          </div>
        </div>
      </section>
    </div>
  );
}
