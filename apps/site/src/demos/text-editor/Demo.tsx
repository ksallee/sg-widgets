import { useState } from 'react';
import { TextEditor } from '@/registry/sg/components/text-editor';

const field = { displayName: 'Description', mandatory: false };

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function TextEditorDemo() {
  const [one, setOne] = useState<string | null>('Plate delivered.');
  const [many, setMany] = useState<string | null>('Plate delivered.\nSecond pass pending.');
  const blocked = 'sh010_comp_v001';

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            input
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <TextEditor value={one} onValueChange={setOne} field={field} placeholder="Type here" />
              <p className={valueCell}>{JSON.stringify(one)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            multiline
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <TextEditor value={many} onValueChange={setMany} field={field} multiline />
              <p className={valueCell}>{JSON.stringify(many)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            readonly
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <TextEditor value={blocked} field={field} readonly />
              <p className={valueCell}>{JSON.stringify(blocked)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            disabled
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <TextEditor value={blocked} field={field} disabled />
              <p className={valueCell}>{JSON.stringify(blocked)}</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            invalid
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <TextEditor value={null} field={field} invalid error="The site refused this value." />
              <p className={valueCell}>null</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
