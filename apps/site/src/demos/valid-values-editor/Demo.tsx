import { useMemo, useState } from 'react';
import { ValidValuesEditor } from '@/registry/sg/components/valid-values-editor';
import { createDemoContext } from '../_shared/client';

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground font-mono text-xs break-words';

const TYPES = ['Type A', 'Type B', 'Type C'];
const TWO_TYPES = ['Type A', 'Type B'];
const TWO_CODES = ['ip', 'fin'];
const NONE: string[] = [];

export default function ValidValuesEditorDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [shotTypes, setShotTypes] = useState<string[]>(['VFX', '2D', 'Full CG', 'Look Dev']);
  const [fresh, setFresh] = useState<string[]>([]);
  const [distinct, setDistinct] = useState<string[]>(['Type A', 'Type B']);
  const [statuses, setStatuses] = useState<string[]>(['ip', 'rev', 'apr']);
  const [codes, setCodes] = useState<string[]>(['wtg', 'ip', 'fin']);

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            list
          </th>
          <td className={cell}>
            <div data-demo="list" className="flex w-full min-w-0 flex-col gap-2">
              <ValidValuesEditor value={shotTypes} onValueChange={setShotTypes} />
              <p className={valueCell}>{JSON.stringify(shotTypes)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            empty
          </th>
          <td className={cell}>
            <div data-demo="empty" className="flex w-full min-w-0 flex-col gap-2">
              <ValidValuesEditor value={fresh} onValueChange={setFresh} />
              <p className={valueCell}>{JSON.stringify(fresh)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            unique
          </th>
          <td className={cell}>
            <div data-demo="unique" className="flex w-full min-w-0 flex-col gap-2">
              <ValidValuesEditor value={distinct} onValueChange={setDistinct} unique size="sm" />
              <p className={valueCell}>{JSON.stringify(distinct)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            status list
          </th>
          <td className={cell}>
            <div data-demo="status" className="flex w-full min-w-0 flex-col gap-2">
              <ValidValuesEditor dataType="status_list" context={context} value={statuses} onValueChange={setStatuses} />
              <p className={valueCell}>{JSON.stringify(statuses)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            status list, no site
          </th>
          <td className={cell}>
            <div data-demo="codes" className="flex w-full min-w-0 flex-col gap-2">
              <ValidValuesEditor
                dataType="status_list"
                value={codes}
                onValueChange={setCodes}
                placeholder="Add a status code"
              />
              <p className={valueCell}>{JSON.stringify(codes)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            readonly
          </th>
          <td className={cell}>
            <div data-demo="readonly" className="flex w-full min-w-0 flex-col gap-2">
              <ValidValuesEditor value={TYPES} readonly />
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            readonly status list
          </th>
          <td className={cell}>
            <div data-demo="readonly-status" className="flex w-full min-w-0 flex-col gap-2">
              <ValidValuesEditor dataType="status_list" context={context} value={TWO_CODES} readonly />
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            invalid
          </th>
          <td className={cell}>
            <div data-demo="invalid" className="flex w-full min-w-0 flex-col gap-2">
              <ValidValuesEditor value={NONE} invalid />
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            disabled
          </th>
          <td className={cell}>
            <div data-demo="disabled" className="flex w-full min-w-0 flex-col gap-2">
              <ValidValuesEditor value={TWO_TYPES} disabled />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
