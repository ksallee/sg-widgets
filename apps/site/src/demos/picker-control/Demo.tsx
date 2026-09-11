import { useState } from 'react';
import { matchesTokens } from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { PickerControl } from '@/registry/sg/components/picker-control';
import {
  PICKER_ARMED,
  PICKER_ROW,
  PICKER_TEXT_CHIP,
  PICKER_TEXT_CHIP_BOX,
} from '@/registry/sg/components/picker-classes';
import { cn } from '@/lib/utils';

/** The rows both controls offer. A wrapper's own vocabulary is all it adds. */
const DEPARTMENTS = [
  { code: 'layout', label: 'Layout' },
  { code: 'anim', label: 'Animation' },
  { code: 'light', label: 'Lighting' },
  { code: 'comp', label: 'Compositing' },
  { code: 'fx', label: 'Effects' },
  { code: 'mm', label: 'Matchmove' },
  { code: 'rig', label: 'Rigging' },
  { code: 'edit', label: 'Editorial' },
];

const labelOf = (code: string) => DEPARTMENTS.find((d) => d.code === code)?.label ?? code;
const matching = (query: string) => DEPARTMENTS.filter((d) => matchesTokens(query, d.label, d.code));
const chipClass = cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX.md);

const field = 'flex w-full flex-col gap-2';
const label = 'text-muted-foreground text-xs';
const readout = 'text-muted-foreground font-mono text-xs';

function row(slot: string, code: string) {
  return (
    <ComboboxPrimitive.Item key={code} data-slot={`${slot}-option`} value={code} className={PICKER_ROW}>
      {labelOf(code)}
    </ComboboxPrimitive.Item>
  );
}

export default function PickerControlDemo() {
  const [one, setOne] = useState<string[]>([]);
  const [many, setMany] = useState<string[]>(['anim', 'light']);
  const [oneOpen, setOneOpen] = useState(false);
  const [manyOpen, setManyOpen] = useState(false);
  const [oneQuery, setOneQuery] = useState('');
  const [manyQuery, setManyQuery] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <div className={field} data-demo-case="inline">
        <span className={label}>Inline, one department: the caret sits beside the chip</span>
        <div className="relative flex w-full min-w-0 items-center">
          <PickerControl
            slot="department-picker"
            picker="department"
            keys={one}
            onSelect={setOne}
            labels={one.map(labelOf)}
            items={matching(oneQuery).map((d) => d.code)}
            renderItem={(code) => row('department-picker', code)}
            renderChip={(index, armed) => (
              <span
                key={one[index]}
                data-slot="department-picker-chip"
                data-chip=""
                className={cn(chipClass, armed && PICKER_ARMED)}
              >
                {labelOf(one[index] ?? '')}
              </span>
            )}
            placeholder="Select a department"
            open={oneOpen}
            onOpenChange={setOneOpen}
            query={oneQuery}
            onQueryChange={setOneQuery}
            onRemoveAt={() => setOne([])}
            onClear={() => setOne([])}
            // What the primitive writes into the caret for the chosen item: the chip
            // already says it.
            itemToStringLabel={() => ''}
            empty={matching(oneQuery).length === 0}
            triggerLabel="Show the departments"
          />
        </div>
        <span className={readout}>{JSON.stringify(one)}</span>
      </div>

      <div className={field} data-demo-case="summary">
        <span className={label}>Summary, several departments: the search box moves into the popup</span>
        <div className="relative flex w-full min-w-0 items-center">
          <PickerControl
            slot="department-multi-picker"
            picker="department-multi"
            multiple
            chipRow
            inline={false}
            keys={many}
            onSelect={setMany}
            labels={many.map(labelOf)}
            items={matching(manyQuery).map((d) => d.code)}
            renderItem={(code) => row('department-multi-picker', code)}
            renderChip={(index, armed, hidden) => (
              <span
                key={many[index]}
                data-slot="department-multi-picker-chip"
                data-chip=""
                hidden={hidden}
                className={cn(chipClass, armed && PICKER_ARMED)}
              >
                <span className="truncate">{labelOf(many[index] ?? '')}</span>
              </span>
            )}
            placeholder="Select departments"
            searchPlaceholder="Search departments…"
            open={manyOpen}
            onOpenChange={setManyOpen}
            query={manyQuery}
            onQueryChange={setManyQuery}
            onRemoveAt={(index) => setMany(many.filter((_, i) => i !== index))}
            onClear={() => setMany([])}
            empty={matching(manyQuery).length === 0}
            triggerLabel="Show the departments"
          />
        </div>
        <span className={readout}>{JSON.stringify(many)}</span>
      </div>
    </div>
  );
}
