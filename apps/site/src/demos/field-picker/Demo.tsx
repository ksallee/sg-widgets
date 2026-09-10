import { useState } from 'react';
import { FieldPicker } from '@/registry/sg/components/field-picker';
import { DemoContextProvider, useSgContext } from '../_shared/react';

const label = 'text-muted-foreground text-xs';
const path = 'text-muted-foreground font-mono text-xs';
const DATES = ['date', 'date_time'];
const HIDDEN = ['image'];
const COMPUTED = [
  { name: 'row_number', displayName: 'Row Number' },
  { name: 'note_count', displayName: 'Note Count' },
];

function Pickers() {
  const context = useSgContext();
  const [free, setFree] = useState('');
  const [dated, setDated] = useState('');
  const [preset, setPreset] = useState('entity.Shot.sg_turnover_date');
  const [computed, setComputed] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" data-demo="free">
        <span className={label}>
          Version, deep links on: Link asks which type, Project descends at once
        </span>
        <FieldPicker
          context={context}
          entityType="Version"
          deepLinks
          value={free}
          onValueChange={setFree}
        />
        <span className={path}>{free || '—'}</span>
      </div>

      <div className="flex flex-col gap-2" data-demo="dates">
        <span className={label}>
          Restricted to dates: links stay on the list so a nested date is reachable
        </span>
        <FieldPicker
          context={context}
          entityType="Version"
          deepLinks
          dataTypes={DATES}
          value={dated}
          onValueChange={setDated}
          placeholder="Select a date field"
        />
        <span className={path}>{dated || '—'}</span>
      </div>

      <div className="flex flex-col gap-2" data-demo="preset">
        <span className={label}>A dotted value, shown as its friendly path</span>
        <FieldPicker
          context={context}
          entityType="Version"
          deepLinks
          value={preset}
          onValueChange={setPreset}
        />
        <span className={path}>{preset || '—'}</span>
      </div>

      <div className="flex flex-col gap-2" data-demo="computed">
        <span className={label}>
          Filterable types only, with two computed columns and a hidden path
        </span>
        <FieldPicker
          context={context}
          entityType="Shot"
          filterableOnly
          hidePaths={HIDDEN}
          extraFields={COMPUTED}
          value={computed}
          onValueChange={setComputed}
        />
        <span className={path}>{computed || '—'}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Sizes, read-only and invalid</span>
        <FieldPicker context={context} entityType="Shot" value="code" size="sm" />
        <FieldPicker context={context} entityType="Shot" value="sg_status_list" size="lg" />
        <FieldPicker context={context} entityType="Shot" value="description" readonly />
        <FieldPicker context={context} entityType="Shot" value="" invalid />
        <FieldPicker context={context} entityType="Shot" value="sg_cut_in" disabled />
      </div>
    </div>
  );
}

export default function FieldPickerDemo() {
  return (
    <DemoContextProvider>
      <Pickers />
    </DemoContextProvider>
  );
}
