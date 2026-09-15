/**
 * The empty and error line at each of its paddings: inside a popup-sized box, in a
 * table body, and under rows already drawn.
 *
 * Each case carries `data-demo-case`, so a drive script reads it without knowing the
 * surrounding markup. Nothing here is read from a site.
 */
import { CircleAlert, Inbox, SearchX, TriangleAlert } from 'lucide-react';
import { StateLine } from '@/registry/sg/components/state-line';

/** The rows the last case draws its line under. */
const DEPARTMENTS = ['Layout', 'Animation', 'Lighting'];

const stack = 'flex flex-col gap-4';
const section = 'flex flex-col gap-2';
const heading = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const spread = 'flex flex-wrap items-start gap-4';
const popoverBox = 'border-border w-72 rounded-md border p-1';
const bodyBox = 'border-border w-full min-w-0 rounded-md border';
const listRow = 'flex items-center px-2 py-1.5 text-sm';

export default function StateLineDemo() {
  return (
    <div className={stack}>
      <section className={section} data-demo-case="popover">
        <h4 className={heading}>In a popup list</h4>
        <div className={spread}>
          <div className={popoverBox}>
            <StateLine state="empty" icon={SearchX} label="No department matches" />
          </div>
          <div className={popoverBox}>
            <StateLine state="error" icon={TriangleAlert} label="The read was refused" />
          </div>
        </div>
      </section>

      <section className={section} data-demo-case="table">
        <h4 className={heading}>In a table body</h4>
        <div className={spread}>
          <div className={bodyBox}>
            <StateLine state="empty" pad="table" icon={Inbox} label="No shot in this window" />
          </div>
          <div className={bodyBox}>
            <StateLine state="error" pad="table" icon={CircleAlert} label="The read timed out" />
          </div>
        </div>
      </section>

      <section className={section} data-demo-case="under-rows">
        <h4 className={heading}>Under rows already drawn</h4>
        <div className={bodyBox}>
          <div className="flex flex-col">
            {DEPARTMENTS.map((department) => (
              <div key={department} className={listRow}>
                {department}
              </div>
            ))}
            <StateLine
              state="error"
              pad="none"
              slotName="state-line-page-error"
              icon={CircleAlert}
              label="The next page did not arrive"
              className="p-2"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
