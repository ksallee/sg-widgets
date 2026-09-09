import { useState } from 'react';
import { DateEditor } from '@/registry/sg/components/date-editor';

const field = { displayName: 'Turnover Date', mandatory: false };
const item = 'flex w-full min-w-0 flex-col gap-2';
const nameCell = 'text-muted-foreground font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function DateEditorDemo() {
  const [turnover, setTurnover] = useState<string | null>('2026-09-02');
  const [expected, setExpected] = useState<string | null>(null);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className={item} data-demo-row="sm">
        <p className={nameCell}>sm</p>
        <DateEditor value={turnover} onValueChange={setTurnover} size="sm" field={field} />
      </div>
      <div className={item} data-demo-row="md">
        <p className={nameCell}>md</p>
        <DateEditor value={turnover} onValueChange={setTurnover} field={field} />
        <p className={valueCell} data-demo-value="set">
          {JSON.stringify(turnover)}
        </p>
      </div>
      <div className={item} data-demo-row="lg">
        <p className={nameCell}>lg</p>
        <DateEditor value={turnover} onValueChange={setTurnover} size="lg" field={field} />
      </div>
      <div className={item} data-demo-row="unset">
        <p className={nameCell}>unset</p>
        <DateEditor
          value={expected}
          onValueChange={setExpected}
          field={{ displayName: 'Next Version Expected', mandatory: false }}
        />
        <p className={valueCell} data-demo-value="unset">
          {JSON.stringify(expected)}
        </p>
      </div>
      <div className={item} data-demo-row="invalid">
        <p className={nameCell}>invalid</p>
        <DateEditor value="2026-09-02" invalid error="Outside the shoot window." field={field} />
      </div>
      <div className={item} data-demo-row="readonly">
        <p className={nameCell}>readonly</p>
        <DateEditor value="2026-09-02" readonly field={field} />
      </div>
      <div className={item} data-demo-row="disabled">
        <p className={nameCell}>disabled</p>
        <DateEditor value="2026-09-02" disabled field={field} />
      </div>
    </div>
  );
}
