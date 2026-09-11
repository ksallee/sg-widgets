import { useState } from 'react';
import { ColumnPicker } from '@/registry/sg/components/column-picker';
import { DemoContextProvider, useSgContext } from '../_shared/react';

const label = 'text-muted-foreground text-xs';
const LOCKED = ['code', 'sg_cut_in'];

function Pickers() {
  const context = useSgContext();
  const [columns, setColumns] = useState(['code', 'sg_status_list', 'entity.Shot.sg_turnover_date']);
  const [dates, setDates] = useState(['entity.Shot.updated_at']);
  const [dual, setDual] = useState(['code', 'sg_cut_in']);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" data-demo="columns">
        <span className={label}>
          Columns on Version: pick a field, then drag the list into order
        </span>
        <ColumnPicker
          context={context}
          entityType="Version"
          showCount
          value={columns}
          onValueChange={setColumns}
        />
        <span className="text-muted-foreground font-mono text-xs">[{columns.join(', ')}]</span>
      </div>

      <div className="flex flex-col gap-2" data-demo="dates">
        <span className={label}>
          Date-times only: links stay on the list, so a timestamp behind one is reachable
        </span>
        <ColumnPicker
          context={context}
          entityType="Version"
          dataTypes="date_time"
          value={dates}
          onValueChange={setDates}
        />
      </div>

      <div className="flex flex-col gap-2" data-demo="dual">
        <span className={label}>
          Dual: the fields of the type on the left, the chosen paths on the right
        </span>
        <ColumnPicker
          context={context}
          entityType="Shot"
          layout="dual"
          filterableOnly
          value={dual}
          onValueChange={setDual}
        />
      </div>

      <div className="flex flex-col gap-2" data-demo="disabled">
        <span className={label}>Disabled</span>
        <ColumnPicker context={context} entityType="Shot" value={LOCKED} disabled />
      </div>

      <div className="flex flex-col gap-2" data-demo="readonly">
        <span className={label}>Read-only: the chosen list alone</span>
        <ColumnPicker context={context} entityType="Shot" value={LOCKED} readonly />
      </div>
    </div>
  );
}

export default function ColumnPickerDemo() {
  return (
    <DemoContextProvider>
      <Pickers />
    </DemoContextProvider>
  );
}
