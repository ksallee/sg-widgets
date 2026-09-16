import { useState } from 'react';
import { ListPicker } from '@/registry/sg/components/list-picker';

const versionType = {
  displayName: 'Version Type',
  mandatory: false,
  validValues: ['Type A', 'Type B', 'Type C'],
};

const shotType = {
  displayName: 'Shot Type',
  mandatory: false,
  validValues: ['VFX', '2D', 'Full CG', 'Trailer', 'Marketing', 'Look Dev'],
  displayValues: { '2D': 'Two D', 'Look Dev': 'Lookdev' },
  hiddenValues: ['Marketing', 'Trailer'],
};

/** A field the site flags mandatory: the picker offers no clear. */
const step = {
  displayName: 'Pipeline Step',
  mandatory: true,
  validValues: ['Model', 'Rig', 'Animate', 'Light', 'Comp'],
};

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function ListPickerDemo() {
  const [type, setType] = useState<string | null>('Type A');
  const [shot, setShot] = useState<string | null>('VFX');
  const [scoped, setScoped] = useState<string | null>('Full CG');
  const [searched, setSearched] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>('Model');

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            valid values
          </th>
          <td className={cell}>
            <div data-demo="values" data-field-mandatory="false" className="flex w-full min-w-0 flex-col gap-2">
              <ListPicker value={type} onValueChange={setType} field={versionType} />
              <p className={valueCell}>{JSON.stringify(type)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            display values
          </th>
          <td className={cell}>
            <div data-demo="labels" data-field-mandatory="false" className="flex w-full min-w-0 flex-col gap-2">
              <ListPicker value={shot} onValueChange={setShot} field={shotType} showCode />
              <p className={valueCell}>{JSON.stringify(shot)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            project 63
          </th>
          <td className={cell}>
            <div data-demo="project" data-field-mandatory="false" className="flex w-full min-w-0 flex-col gap-2">
              <ListPicker value={scoped} onValueChange={setScoped} field={shotType} projectId={63} />
              <p className={valueCell}>{JSON.stringify(scoped)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            searchable
          </th>
          <td className={cell}>
            <div data-demo="searchable" data-field-mandatory="false" className="flex w-full min-w-0 flex-col gap-2">
              <ListPicker value={searched} onValueChange={setSearched} field={shotType} searchable />
              <p className={valueCell}>{JSON.stringify(searched)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            mandatory
          </th>
          <td className={cell}>
            <div data-demo="mandatory" data-field-mandatory={String(step.mandatory)} className="flex w-full min-w-0 flex-col gap-2">
              <ListPicker value={chosen} onValueChange={setChosen} field={step} />
              <p className={valueCell}>{JSON.stringify(chosen)}</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            disabled
          </th>
          <td className={cell}>
            <div data-demo="disabled" className="flex w-full min-w-0 flex-col gap-2">
              <ListPicker value="Type B" field={versionType} disabled />
              <p className={valueCell}>"Type B"</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
