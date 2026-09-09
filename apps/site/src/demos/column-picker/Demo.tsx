import { useMemo, useState } from 'react';
import { createSchemaService } from '@sg-widgets/core';
import { ColumnPicker } from '@/registry/sg/components/column-picker';
import { DemoClientProvider, useSgClient } from '../_shared/react';

const label = 'text-muted-foreground text-xs';
const READONLY = ['code', 'sg_cut_in'];

function Pickers() {
  const client = useSgClient();
  const schema = useMemo(() => createSchemaService(client), [client]);
  const [columns, setColumns] = useState(['code', 'sg_status_list', 'entity.Shot.sg_turnover_date']);
  const [compact, setCompact] = useState(['code', 'sg_version_type']);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" data-demo="ordered">
        <span className={label}>
          Ordered columns on Version: add, drag a grip, or Alt with an arrow key
        </span>
        <ColumnPicker
          schema={schema}
          entityType="Version"
          value={columns}
          onValueChange={setColumns}
        />
        <span className="text-muted-foreground font-mono text-xs">[{columns.join(', ')}]</span>
      </div>

      <div className="flex flex-col gap-2" data-demo="compact">
        <span className={label}>Compact: inline chips, no ordering</span>
        <ColumnPicker
          schema={schema}
          entityType="Shot"
          compact
          filterableOnly
          value={compact}
          onValueChange={setCompact}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Read-only</span>
        <ColumnPicker schema={schema} entityType="Shot" value={READONLY} readOnly />
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
