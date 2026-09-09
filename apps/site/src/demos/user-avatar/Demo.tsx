import { useEffect, useState } from 'react';
import { UserAvatar } from '@/registry/sg/components/user-avatar';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const row = 'flex flex-wrap items-center gap-2';

interface Person {
  name: string;
  image: string | null;
  inactive: boolean;
}

function People() {
  const client = useSgClient();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    client
      .search('HumanUser', { fields: ['name', 'image', 'sg_status_list'], page: { size: 6 } })
      .then((result) => {
        if (!live) return;
        setPeople(
          result.data.map((r) => ({
            name: String(r.attributes['name'] ?? ''),
            image: (r.attributes['image'] as string | null) ?? null,
            inactive: r.attributes['sg_status_list'] === 'dis',
          })),
        );
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [client]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!people) return <p className="text-muted-foreground text-sm">Loading people…</p>;

  return (
    <>
      <section className={group}>
        <h4 className={label}>Sizes</h4>
        <div className={row}>
          <UserAvatar name={people[0]?.name ?? ''} image={people[0]?.image} size="sm" />
          <UserAvatar name={people[0]?.name ?? ''} image={people[0]?.image} size="md" />
          <UserAvatar name={people[0]?.name ?? ''} image={people[0]?.image} size="lg" />
        </div>
      </section>

      <section className={group}>
        <h4 className={label}>The site's people</h4>
        <div className={row}>
          {people.map((person) => (
            <UserAvatar key={person.name} name={person.name} image={person.image} inactive={person.inactive} />
          ))}
        </div>
      </section>
    </>
  );
}

export default function UserAvatarDemo() {
  return (
    <DemoClientProvider>
      <div className="flex flex-col gap-4">
        <People />

        <section className={group}>
          <h4 className={label}>Initials fallback</h4>
          <div className={row}>
            <UserAvatar name="Ada Lovelace" />
            <UserAvatar name="Kevin van der Meer" />
            <UserAvatar name="Madonna" />
            <UserAvatar name="k.sallee" />
            <UserAvatar name="" />
          </div>
        </section>

        <section className={group}>
          <h4 className={label}>Inactive, and an image that fails to load</h4>
          <div className={row}>
            <UserAvatar name="Grace Hopper" inactive />
            <UserAvatar name="Grace Hopper" image="https://picsum.photos/seed/grace.hopper/64/64" inactive />
            <UserAvatar name="Alan Turing" image="data:image/png;base64,iVBORw0KGgo=" />
          </div>
        </section>

        <section className={group} data-demo="api">
          <h4 className={label}>API users</h4>
          <div className={row}>
            <UserAvatar name="sg_widgets_demo" apiUser size="sm" />
            <UserAvatar name="sg_widgets_demo" apiUser />
            <UserAvatar name="sg_widgets_demo" apiUser size="lg" />
            <UserAvatar name="sg_widgets_demo" apiUser inactive />
          </div>
        </section>
      </div>
    </DemoClientProvider>
  );
}
