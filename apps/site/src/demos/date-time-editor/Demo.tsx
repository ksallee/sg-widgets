import { useState } from 'react';
import { DateTimeEditor } from '@/registry/sg/components/date-time-editor';

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function DateTimeEditorDemo() {
  const [approvedAt, setApprovedAt] = useState<string | null>('2026-03-04T13:06:07Z');
  const [importedAt, setImportedAt] = useState<string | null>('2026-03-04T13:06:07Z');
  const [never, setNever] = useState<string | null>(null);

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            Los Angeles
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <DateTimeEditor
                value={approvedAt}
                onValueChange={setApprovedAt}
                timeZone="America/Los_Angeles"
                field={{ displayName: 'Client Approved At', mandatory: false }}
              />
              <p className={valueCell}>{JSON.stringify(approvedAt)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            Paris, seconds
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <DateTimeEditor
                value={importedAt}
                onValueChange={setImportedAt}
                timeZone="Europe/Paris"
                showSeconds
                field={{ displayName: 'Media Center Import Time', mandatory: false }}
              />
              <p className={valueCell}>{JSON.stringify(importedAt)}</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            unset
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <DateTimeEditor value={never} onValueChange={setNever} timeZone="UTC" />
              <p className={valueCell}>{JSON.stringify(never)}</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
