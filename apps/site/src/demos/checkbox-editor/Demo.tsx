import { useState } from 'react';
import { CheckboxEditor } from '@/registry/sg/components/checkbox-editor';

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function CheckboxEditorDemo() {
  const [flagged, setFlagged] = useState(true);
  const [approved, setApproved] = useState(false);

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            flagged
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <CheckboxEditor
                value={flagged}
                onValueChange={setFlagged}
                field={{ displayName: 'Flagged', mandatory: false }}
              />
              <p className={valueCell}>{JSON.stringify(flagged)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            client approved
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <CheckboxEditor
                value={approved}
                onValueChange={setApproved}
                field={{ displayName: 'Client Approved', mandatory: false }}
                labels={{ on: 'Approved', off: 'Not approved' }}
              />
              <p className={valueCell}>{JSON.stringify(approved)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            readonly
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <CheckboxEditor value={true} readonly />
              <p className={valueCell}>true</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            disabled
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <CheckboxEditor value={false} disabled />
              <p className={valueCell}>false</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
