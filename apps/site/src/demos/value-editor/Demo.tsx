import { useState } from 'react';
import type { ParseResult } from '@sg-widgets/core';
import { Input } from '@/components/ui/input';
import { CONTROL_BOX, type ControlSize } from '@/registry/sg/components/control-classes';
import { ValueEditor, useValueSession } from '@/registry/sg/components/value-editor';

/** What this editor stores: the first and the last frame of a range. */
type Range = { first: number; last: number } | null;

const format = (value: Range) => (value ? `${value.first}-${value.last}` : '');

function parse(draft: string): ParseResult<Range> {
  const raw = draft.trim();
  if (!raw) return { value: null };
  const match = /^(\d+)\s*-\s*(\d+)$/.exec(raw);
  if (!match) return { error: 'A range reads as two frames, 1001-1120.' };
  const first = Number(match[1]);
  const last = Number(match[2]);
  if (last < first) return { error: 'The last frame comes before the first.' };
  return { value: { first, last } };
}

/** A pair is a new object every parse, so identity is not what says it changed. */
const same = (next: Range, current: Range) =>
  next?.first === current?.first && next?.last === current?.last;

const field = 'flex w-full min-w-0 flex-col gap-2';
const label = 'text-muted-foreground text-xs';
const readout = 'text-muted-foreground font-mono text-xs';

interface RangeEditorProps {
  name: string;
  caption: string;
  value: Range;
  onValueChange: (value: Range) => void;
  size: ControlSize;
  inline: boolean;
  error?: string | null;
}

function RangeEditor({ name, caption, value, onValueChange, size, inline, error = null }: RangeEditorProps) {
  const session = useValueSession<Range, string>({ value, format, parse, same, onValueChange, error });

  return (
    <div className={field} data-demo-case={name}>
      <span className={label}>{caption}</span>
      <ValueEditor slotName="range-editor" size={size} inline={inline} message={session.message}>
        <Input
          value={session.draft}
          type="text"
          placeholder="1001-1120"
          className={CONTROL_BOX[size]}
          aria-invalid={session.invalid}
          aria-label={caption}
          onChange={(event) => session.setDraft(event.target.value)}
          onFocus={session.onFocus}
          onBlur={session.onBlur}
          onKeyDown={session.onKeyDown}
        />
      </ValueEditor>
      <span className={readout} data-demo-value="">
        {JSON.stringify(value)}
      </span>
    </div>
  );
}

export default function ValueEditorDemo() {
  const [cut, setCut] = useState<Range>({ first: 1001, last: 1120 });
  const [delivery, setDelivery] = useState<Range>({ first: 1001, last: 1064 });

  return (
    <div className="flex flex-col gap-4">
      <RangeEditor
        name="cut"
        caption="Cut range: commits on Enter and on leaving, restores on Escape"
        value={cut}
        onValueChange={setCut}
        size="md"
        inline={false}
      />
      <RangeEditor
        name="delivery"
        caption="Delivery range: the row form, small, with a message the caller named"
        value={delivery}
        onValueChange={setDelivery}
        size="sm"
        inline
        error="The site refused this range."
      />
    </div>
  );
}
