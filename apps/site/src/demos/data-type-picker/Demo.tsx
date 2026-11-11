import { useState } from 'react';
import { DataTypePicker } from '@/registry/sg/components/data-type-picker';

/** The types a site created over REST (019_create_fields). The caller owns this list. */
const creatable = [
  'text',
  'number',
  'float',
  'percent',
  'duration',
  'footage',
  'date',
  'date_time',
  'checkbox',
  'list',
  'entity',
  'multi_entity',
  'url',
];

const wording = { url: 'File or link', entity: 'Link to one', multi_entity: 'Link to many' };

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function DataTypePickerDemo() {
  const [chosen, setChosen] = useState<string | null>('text');
  const [searched, setSearched] = useState<string | null>(null);
  const [worded, setWorded] = useState<string | null>('url');
  const [cleared, setCleared] = useState<string | null>('date_time');

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            a given set
          </th>
          <td className={cell}>
            <div data-demo="set" className="flex w-full min-w-0 flex-col gap-2">
              <DataTypePicker value={chosen} onValueChange={setChosen} types={creatable} />
              <p className={valueCell}>{JSON.stringify(chosen)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            searchable
          </th>
          <td className={cell}>
            <div data-demo="searchable" className="flex w-full min-w-0 flex-col gap-2">
              <DataTypePicker value={searched} onValueChange={setSearched} types={creatable} searchable />
              <p className={valueCell}>{JSON.stringify(searched)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            own labels
          </th>
          <td className={cell}>
            <div data-demo="labels" className="flex w-full min-w-0 flex-col gap-2">
              <DataTypePicker value={worded} onValueChange={setWorded} types={creatable} labels={wording} />
              <p className={valueCell}>{JSON.stringify(worded)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            clearable
          </th>
          <td className={cell}>
            <div data-demo="clearable" className="flex w-full min-w-0 flex-col gap-2">
              <DataTypePicker value={cleared} onValueChange={setCleared} types={creatable} clearable size="sm" />
              <p className={valueCell}>{JSON.stringify(cleared)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            readonly, outside the set
          </th>
          <td className={cell}>
            <div data-demo="outside" className="flex w-full min-w-0 flex-col gap-2">
              <DataTypePicker value="calculated" types={creatable} readonly />
              <p className={valueCell}>"calculated"</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            readonly, unknown
          </th>
          <td className={cell}>
            <div data-demo="unknown" className="flex w-full min-w-0 flex-col gap-2">
              <DataTypePicker value="sg_future_type" types={creatable} readonly />
              <p className={valueCell}>"sg_future_type"</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            disabled
          </th>
          <td className={cell}>
            <div data-demo="disabled" className="flex w-full min-w-0 flex-col gap-2">
              <DataTypePicker value="list" types={creatable} disabled />
              <p className={valueCell}>"list"</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
