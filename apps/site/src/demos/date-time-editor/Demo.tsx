import { useState } from 'react';
import { DateTimeEditor } from '@/registry/sg/components/date-time-editor';

const zone = 'America/Los_Angeles';
const field = { displayName: 'Client Approved At', mandatory: false };
const item = 'flex w-full min-w-0 flex-col gap-2';
const nameCell = 'text-muted-foreground font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function DateTimeEditorDemo() {
  const [approvedAt, setApprovedAt] = useState<string | null>('2026-03-04T13:06:07Z');
  const [importedAt, setImportedAt] = useState<string | null>('2026-03-04T13:06:07Z');
  const [never, setNever] = useState<string | null>(null);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className={item} data-demo-row="sm">
        <p className={nameCell}>sm</p>
        <DateTimeEditor
          value={approvedAt}
          onValueChange={setApprovedAt}
          timeZone={zone}
          size="sm"
          hint={false}
          field={field}
        />
      </div>
      <div className={item} data-demo-row="md">
        <p className={nameCell}>md</p>
        <DateTimeEditor value={approvedAt} onValueChange={setApprovedAt} timeZone={zone} field={field} />
        <p className={valueCell} data-demo-value="set">
          {JSON.stringify(approvedAt)}
        </p>
      </div>
      <div className={item} data-demo-row="lg">
        <p className={nameCell}>lg</p>
        <DateTimeEditor
          value={approvedAt}
          onValueChange={setApprovedAt}
          timeZone={zone}
          size="lg"
          hint={false}
          field={field}
        />
      </div>
      <div className={item} data-demo-row="seconds">
        <p className={nameCell}>Paris, seconds</p>
        <DateTimeEditor
          value={importedAt}
          onValueChange={setImportedAt}
          timeZone="Europe/Paris"
          showSeconds
          field={{ displayName: 'Media Center Import Time', mandatory: false }}
        />
        <p className={valueCell} data-demo-value="seconds">
          {JSON.stringify(importedAt)}
        </p>
      </div>
      <div className={item} data-demo-row="unset">
        <p className={nameCell}>unset</p>
        <DateTimeEditor value={never} onValueChange={setNever} timeZone="UTC" />
        <p className={valueCell} data-demo-value="unset">
          {JSON.stringify(never)}
        </p>
      </div>
      <div className={item} data-demo-row="invalid">
        <p className={nameCell}>invalid</p>
        <DateTimeEditor
          value="2026-03-04T13:06:07Z"
          timeZone={zone}
          hint={false}
          invalid
          error="Before the version was delivered."
          field={field}
        />
      </div>
      <div className={item} data-demo-row="readonly">
        <p className={nameCell}>readonly</p>
        <DateTimeEditor value="2026-03-04T13:06:07Z" timeZone={zone} hint={false} readonly field={field} />
      </div>
      <div className={item} data-demo-row="disabled">
        <p className={nameCell}>disabled</p>
        <DateTimeEditor value="2026-03-04T13:06:07Z" timeZone={zone} hint={false} disabled field={field} />
      </div>
    </div>
  );
}
