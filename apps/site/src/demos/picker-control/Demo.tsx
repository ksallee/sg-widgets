import { useState } from 'react';
import type { ReactNode } from 'react';
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

/** The rows every control offers. A wrapper's own vocabulary is all it adds. */
const DEPARTMENTS = [
  { code: 'layout', label: 'Layout', lead: 'Anna van der Meer' },
  { code: 'anim', label: 'Animation', lead: 'Piet Oosterhuis' },
  { code: 'light', label: 'Lighting', lead: 'Mira Halloran' },
  { code: 'comp', label: 'Compositing', lead: 'Tomas Bergqvist' },
  { code: 'fx', label: 'Effects', lead: 'Iris Nakamura' },
  { code: 'mm', label: 'Matchmove', lead: 'Ravi Chandrasekar' },
  { code: 'rig', label: 'Rigging', lead: 'Elena Duarte' },
  { code: 'edit', label: 'Editorial', lead: 'Jonas Klein' },
];
const SIZES = ['sm', 'md', 'lg'] as const;

const labelOf = (code: string) => DEPARTMENTS.find((d) => d.code === code)?.label ?? code;
const leadOf = (code: string) => DEPARTMENTS.find((d) => d.code === code)?.lead ?? '';
const matching = (query: string) => DEPARTMENTS.filter((d) => matchesTokens(query, d.label, d.code));
const codes = (query: string) => matching(query).map((d) => d.code);

const field = 'flex w-full flex-col gap-2';
const label = 'text-muted-foreground text-xs';
const readout = 'text-muted-foreground font-mono text-xs';
const box = 'relative flex w-full min-w-0 items-center';
/** At most 20rem, so the measured row has something to cut against. */
const narrow = 'max-w-80';

function row(slot: string, code: string): ReactNode {
  return (
    <ComboboxPrimitive.Item key={code} data-slot={`${slot}-option`} value={code} className={PICKER_ROW}>
      {labelOf(code)}
    </ComboboxPrimitive.Item>
  );
}

function chip(
  slot: string,
  name: string,
  armed: boolean,
  hidden: boolean,
  size: (typeof SIZES)[number],
): ReactNode {
  return (
    <span
      key={name}
      data-slot={`${slot}-chip`}
      data-chip=""
      data-armed={armed ? 'true' : undefined}
      hidden={hidden}
      className={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX[size], armed && PICKER_ARMED)}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}

export default function PickerControlDemo() {
  const [one, setOne] = useState<string[]>([]);
  const [oneOpen, setOneOpen] = useState(false);
  const [oneQuery, setOneQuery] = useState('');
  const [text, setText] = useState<string[]>(['comp']);
  const [textOpen, setTextOpen] = useState(false);
  const [textQuery, setTextQuery] = useState('');
  const [tokens, setTokens] = useState<string[]>(['fx', 'mm']);
  const [tokensOpen, setTokensOpen] = useState(false);
  const [tokensQuery, setTokensQuery] = useState('');
  const [many, setMany] = useState<string[]>(['anim', 'light']);
  const [manyOpen, setManyOpen] = useState(false);
  const [manyQuery, setManyQuery] = useState('');
  const [crowd, setCrowd] = useState<string[]>(DEPARTMENTS.map((d) => d.code));
  const [crowdOpen, setCrowdOpen] = useState(false);
  const [crowdQuery, setCrowdQuery] = useState('');
  const [fixed, setFixed] = useState<string[]>(['rig']);
  const [fixedOpen, setFixedOpen] = useState(false);
  const [sized, setSized] = useState<Record<string, string[]>>({
    sm: ['layout'],
    md: ['anim'],
    lg: ['light'],
  });
  const [sizedOpen, setSizedOpen] = useState<Record<string, boolean>>({});
  const [sizedQuery, setSizedQuery] = useState<Record<string, string>>({ sm: '', md: '', lg: '' });
  const [offOpen, setOffOpen] = useState(false);
  const [readOpen, setReadOpen] = useState(false);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [invalidOpen, setInvalidOpen] = useState(false);
  const [invalidQuery, setInvalidQuery] = useState('');
  const [crew, setCrew] = useState<string[]>(['light']);
  const [crewOpen, setCrewOpen] = useState(false);
  const [crewQuery, setCrewQuery] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <div className={field} data-demo-case="inline">
        <span className={label}>Single, inline: the caret sits beside the chip</span>
        <div className={box}>
          <PickerControl
            slot="department-picker"
            picker="department"
            keys={one}
            onSelect={setOne}
            labels={one.map(labelOf)}
            items={codes(oneQuery)}
            renderItem={(code) => row('department-picker', code)}
            renderChip={(index, armed, hidden) =>
              chip('department-picker', labelOf(one[index] ?? ''), armed, hidden, 'md')
            }
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
            empty={codes(oneQuery).length === 0}
            triggerLabel="Show the departments"
          />
        </div>
        <span className={readout}>{JSON.stringify(one)}</span>
      </div>

      <div className={field} data-demo-case="text">
        <span className={label}>Single, summary: the value reads as plain text, the way a select does</span>
        <div className={box}>
          <PickerControl
            slot="department-text-picker"
            picker="department-text"
            anchored
            inline={false}
            textValue
            keys={text}
            onSelect={setText}
            labels={text.map(labelOf)}
            items={codes(textQuery)}
            renderItem={(code) => row('department-text-picker', code)}
            renderChip={() => (
              <span data-slot="department-text-picker-text" className="truncate">
                {labelOf(text[0] ?? '')}
              </span>
            )}
            placeholder="Select a department"
            searchPlaceholder="Search departments…"
            open={textOpen}
            onOpenChange={setTextOpen}
            query={textQuery}
            onQueryChange={setTextQuery}
            onRemoveAt={() => setText([])}
            onClear={() => setText([])}
            empty={codes(textQuery).length === 0}
            triggerLabel="Show the departments"
          />
        </div>
        <span className={readout}>{JSON.stringify(text)}</span>
      </div>

      <div className={field} data-demo-case="tokens">
        <span className={label}>Several, inline: a token field, chips and query on one line</span>
        <div className={box}>
          <PickerControl
            slot="department-token-picker"
            picker="department-token"
            multiple
            chipRow
            keys={tokens}
            onSelect={setTokens}
            labels={tokens.map(labelOf)}
            items={codes(tokensQuery)}
            renderItem={(code) => row('department-token-picker', code)}
            renderChip={(index, armed, hidden) =>
              chip('department-token-picker', labelOf(tokens[index] ?? ''), armed, hidden, 'md')
            }
            placeholder="Select departments"
            open={tokensOpen}
            onOpenChange={setTokensOpen}
            query={tokensQuery}
            onQueryChange={setTokensQuery}
            onRemoveAt={(index) => setTokens(tokens.filter((_, i) => i !== index))}
            onClear={() => setTokens([])}
            empty={codes(tokensQuery).length === 0}
            triggerLabel="Show the departments"
          />
        </div>
        <span className={readout}>{JSON.stringify(tokens)}</span>
      </div>

      <div className={field} data-demo-case="summary">
        <span className={label}>Several, summary: the search box moves into the popup</span>
        <div className={box}>
          <PickerControl
            slot="department-multi-picker"
            picker="department-multi"
            multiple
            chipRow
            inline={false}
            keys={many}
            onSelect={setMany}
            labels={many.map(labelOf)}
            items={codes(manyQuery)}
            renderItem={(code) => row('department-multi-picker', code)}
            renderChip={(index, armed, hidden) =>
              chip('department-multi-picker', labelOf(many[index] ?? ''), armed, hidden, 'md')
            }
            placeholder="Select departments"
            searchPlaceholder="Search departments…"
            open={manyOpen}
            onOpenChange={setManyOpen}
            query={manyQuery}
            onQueryChange={setManyQuery}
            onRemoveAt={(index) => setMany(many.filter((_, i) => i !== index))}
            onClear={() => setMany([])}
            empty={codes(manyQuery).length === 0}
            triggerLabel="Show the departments"
          />
        </div>
        <span className={readout}>{JSON.stringify(many)}</span>
      </div>

      <div className={field} data-demo-case="overflow">
        <span className={label}>Eight selected in 20rem: whole chips, then a `+n` pill</span>
        <div className={cn(box, narrow)}>
          <PickerControl
            slot="department-multi-picker"
            picker="department-multi"
            multiple
            chipRow
            inline={false}
            summary="ellipsis"
            keys={crowd}
            onSelect={setCrowd}
            labels={crowd.map(labelOf)}
            items={codes(crowdQuery)}
            renderItem={(code) => row('department-multi-picker', code)}
            renderChip={(index, armed, hidden) =>
              chip('department-multi-picker', labelOf(crowd[index] ?? ''), armed, hidden, 'md')
            }
            placeholder="Select departments"
            searchPlaceholder="Search departments…"
            open={crowdOpen}
            onOpenChange={setCrowdOpen}
            query={crowdQuery}
            onQueryChange={setCrowdQuery}
            onRemoveAt={(index) => setCrowd(crowd.filter((_, i) => i !== index))}
            onClear={() => setCrowd([])}
            empty={codes(crowdQuery).length === 0}
            triggerLabel="Show the departments"
          />
        </div>
        <span className={readout}>{crowd.length} selected</span>
      </div>

      <div className={field} data-demo-case="fixed">
        <span className={label}>A fixed set: no search row, and one caret out of sight for the keys</span>
        <div className={box}>
          <PickerControl
            slot="department-fixed-picker"
            picker="department-fixed"
            anchored
            inline={false}
            textValue
            searchable={false}
            keys={fixed}
            onSelect={setFixed}
            labels={fixed.map(labelOf)}
            items={DEPARTMENTS.map((d) => d.code)}
            renderItem={(code) => row('department-fixed-picker', code)}
            renderChip={() => (
              <span data-slot="department-fixed-picker-text" className="truncate">
                {labelOf(fixed[0] ?? '')}
              </span>
            )}
            placeholder="Select a department"
            open={fixedOpen}
            onOpenChange={setFixedOpen}
            query=""
            onQueryChange={() => {}}
            onRemoveAt={() => setFixed([])}
            onClear={() => setFixed([])}
            triggerLabel="Show the departments"
          />
        </div>
        <span className={readout}>{JSON.stringify(fixed)}</span>
      </div>

      <div className={field} data-demo-case="sizes">
        <span className={label}>The three heights</span>
        {SIZES.map((size) => (
          <div key={size} className={box}>
            <PickerControl
              slot="department-picker"
              picker="department"
              size={size}
              keys={sized[size] ?? []}
              onSelect={(keys) => {
                setSized({ ...sized, [size]: keys });
                setSizedQuery({ ...sizedQuery, [size]: '' });
              }}
              labels={(sized[size] ?? []).map(labelOf)}
              items={codes(sizedQuery[size] ?? '')}
              renderItem={(code) => row('department-picker', code)}
              renderChip={(index, armed, hidden) =>
                chip('department-picker', labelOf((sized[size] ?? [])[index] ?? ''), armed, hidden, size)
              }
              placeholder="Select a department"
              open={sizedOpen[size] ?? false}
              onOpenChange={(next) => setSizedOpen({ ...sizedOpen, [size]: next })}
              query={sizedQuery[size] ?? ''}
              onQueryChange={(next) => setSizedQuery({ ...sizedQuery, [size]: next })}
              onRemoveAt={() => setSized({ ...sized, [size]: [] })}
              onClear={() => setSized({ ...sized, [size]: [] })}
              itemToStringLabel={() => ''}
              empty={codes(sizedQuery[size] ?? '').length === 0}
              triggerLabel="Show the departments"
            />
          </div>
        ))}
      </div>

      <div className={field} data-demo-case="states">
        <span className={label}>Disabled, read-only and invalid</span>
        <div className={box}>
          <PickerControl
            slot="department-picker"
            picker="department"
            disabled
            keys={['comp']}
            onSelect={() => {}}
            labels={['Compositing']}
            items={DEPARTMENTS.map((d) => d.code)}
            renderItem={(code) => row('department-picker', code)}
            renderChip={(index, armed, hidden) => chip('department-picker', 'Compositing', armed, hidden, 'md')}
            placeholder="Select a department"
            open={offOpen}
            onOpenChange={setOffOpen}
            query=""
            onQueryChange={() => {}}
            triggerLabel="Show the departments"
          />
        </div>
        <div className={box}>
          <PickerControl
            slot="department-picker"
            picker="department"
            readonly
            keys={['edit']}
            onSelect={() => {}}
            labels={['Editorial']}
            items={DEPARTMENTS.map((d) => d.code)}
            renderItem={(code) => row('department-picker', code)}
            renderChip={(index, armed, hidden) => chip('department-picker', 'Editorial', armed, hidden, 'md')}
            placeholder="Select a department"
            open={readOpen}
            onOpenChange={setReadOpen}
            query=""
            onQueryChange={() => {}}
            triggerLabel="Show the departments"
          />
        </div>
        <div className={box}>
          <PickerControl
            slot="department-picker"
            picker="department"
            invalid
            keys={invalid}
            onSelect={setInvalid}
            labels={invalid.map(labelOf)}
            items={codes(invalidQuery)}
            renderItem={(code) => row('department-picker', code)}
            renderChip={(index, armed, hidden) =>
              chip('department-picker', labelOf(invalid[index] ?? ''), armed, hidden, 'md')
            }
            placeholder="A department is required"
            open={invalidOpen}
            onOpenChange={setInvalidOpen}
            query={invalidQuery}
            onQueryChange={setInvalidQuery}
            onRemoveAt={() => setInvalid([])}
            onClear={() => setInvalid([])}
            itemToStringLabel={() => ''}
            empty={codes(invalidQuery).length === 0}
            triggerLabel="Show the departments"
          />
        </div>
      </div>

      <div className={field} data-demo-case="custom">
        <span className={label}>A row and a chip of the caller's own</span>
        <div className={box}>
          <PickerControl
            slot="department-token-picker"
            picker="department-token"
            multiple
            chipRow
            keys={crew}
            onSelect={setCrew}
            labels={crew.map(labelOf)}
            items={codes(crewQuery)}
            renderItem={(code) => (
              <ComboboxPrimitive.Item
                key={code}
                data-slot="department-token-picker-option"
                value={code}
                className={cn(PICKER_ROW, 'items-start')}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{labelOf(code)}</span>
                  <span className="text-muted-foreground truncate text-xs">{leadOf(code)}</span>
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">{code}</span>
              </ComboboxPrimitive.Item>
            )}
            renderChip={(index, armed, hidden) => {
              const code = crew[index] ?? '';
              return (
                <span
                  key={code}
                  data-slot="department-token-picker-chip"
                  data-chip=""
                  data-armed={armed ? 'true' : undefined}
                  hidden={hidden}
                  className={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX.md, 'gap-1', armed && PICKER_ARMED)}
                >
                  <span className="font-mono text-xs uppercase opacity-60">{code}</span>
                  <span className="truncate">{labelOf(code)}</span>
                </span>
              );
            }}
            placeholder="Select departments"
            open={crewOpen}
            onOpenChange={setCrewOpen}
            query={crewQuery}
            onQueryChange={setCrewQuery}
            onRemoveAt={(index) => setCrew(crew.filter((_, i) => i !== index))}
            onClear={() => setCrew([])}
            empty={codes(crewQuery).length === 0}
            triggerLabel="Show the departments"
          />
        </div>
        <span className={readout}>{JSON.stringify(crew)}</span>
      </div>
    </div>
  );
}
