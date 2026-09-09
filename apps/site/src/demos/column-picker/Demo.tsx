import { useMemo, useState } from 'react';
import { createSchemaService } from '@sg-widgets/core';
import { ColumnPicker } from '@/registry/sg/components/column-picker';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const label = 'text-muted-foreground text-xs';
const LOCKED = ['code', 'sg_cut_in'];

function Pickers() {
  const client = useSgClient();
  const schema = useMemo(() => createSchemaService(client), [client]);
  const [columns, setColumns] = useState(['code', 'sg_status_list', 'entity.Shot.sg_turnover_date']);
  const [dates, setDates] = useState(['entity.Shot.sg_turnover_date']);
  const [dual, setDual] = useState(['code', 'sg_cut_in']);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" data-demo="columns">
        <span className={label}>
          Columns on Version: pick a field, then drag the list into order
        </span>
        <ColumnPicker
          schema={schema}
          entityType="Version"
          showCount
          value={columns}
          onValueChange={setColumns}
        />
        <span className="text-muted-foreground font-mono text-xs">[{columns.join(', ')}]</span>
      </div>

      <div className="flex flex-col gap-2" data-demo="dates">
        <span className={label}>
          Dates only: links stay on the list, so a date behind one is reachable
        </span>
        <ColumnPicker
          schema={schema}
          entityType="Version"
          dataTypes="date"
          value={dates}
          onValueChange={setDates}
        />
      </div>

      <div className="flex flex-col gap-2" data-demo="dual">
        <span className={label}>
          Dual: the fields of the type on the left, the chosen paths on the right
        </span>
        <ColumnPicker
          schema={schema}
          entityType="Shot"
          layout="dual"
          filterableOnly
          value={dual}
          onValueChange={setDual}
        />
      </div>

      <div className="flex flex-col gap-2" data-demo="disabled">
        <span className={label}>Disabled</span>
        <ColumnPicker schema={schema} entityType="Shot" value={LOCKED} disabled />
      </div>

      <div className="flex flex-col gap-2" data-demo="readonly">
        <span className={label}>Read-only: the chosen list alone</span>
        <ColumnPicker schema={schema} entityType="Shot" value={LOCKED} readOnly />
      </div>
    </div>
  );
}

export default function ColumnPickerDemo() {
  return (
    <DemoClientProvider>
      <Pickers />
    </DemoClientProvider>
  );
}
