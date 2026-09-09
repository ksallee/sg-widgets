import { useState } from 'react';
import { DateEditor } from '@/registry/sg/components/date-editor';

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function DateEditorDemo() {
  const [turnover, setTurnover] = useState<string | null>('2026-09-02');
  const [expected, setExpected] = useState<string | null>(null);

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            set
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <DateEditor
                value={turnover}
                onValueChange={setTurnover}
                field={{ displayName: 'Turnover Date', mandatory: false }}
              />
              <p className={valueCell}>{JSON.stringify(turnover)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            unset
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <DateEditor
                value={expected}
                onValueChange={setExpected}
                field={{ displayName: 'Next Version Expected', mandatory: false }}
              />
              <p className={valueCell}>{JSON.stringify(expected)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            readonly
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <DateEditor value="2026-09-02" readonly />
              <p className={valueCell}>"2026-09-02"</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            disabled
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <DateEditor value="2026-09-02" disabled />
              <p className={valueCell}>"2026-09-02"</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
