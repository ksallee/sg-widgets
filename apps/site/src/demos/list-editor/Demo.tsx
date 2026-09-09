import { useState } from 'react';
import { ListEditor } from '@/registry/sg/components/list-editor';

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

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function ListEditorDemo() {
  const [type, setType] = useState<string | null>('Type A');
  const [shot, setShot] = useState<string | null>('VFX');
  const [scoped, setScoped] = useState<string | null>('Full CG');

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            valid values
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <ListEditor value={type} onValueChange={setType} field={versionType} />
              <p className={valueCell}>{JSON.stringify(type)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            display values
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <ListEditor value={shot} onValueChange={setShot} field={shotType} />
              <p className={valueCell}>{JSON.stringify(shot)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            project 63
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <ListEditor value={scoped} onValueChange={setScoped} field={shotType} projectId={63} />
              <p className={valueCell}>{JSON.stringify(scoped)}</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            disabled
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <ListEditor value="Type B" field={versionType} disabled />
              <p className={valueCell}>"Type B"</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
