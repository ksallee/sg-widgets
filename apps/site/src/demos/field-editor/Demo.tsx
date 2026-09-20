import { useState } from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { FieldEditor } from '@/registry/sg/components/field-editor';
import { getDemoContext } from '../_shared/client';

function schema(
  name: string,
  displayName: string,
  dataType: string,
  extra: Partial<FieldSchema> = {},
): FieldSchema {
  return {
    name,
    displayName,
    entityType: 'Version',
    dataType,
    editable: true,
    mandatory: false,
    unique: false,
    ...extra,
  };
}

interface Row {
  key: string;
  field: FieldSchema;
  value: unknown;
  precision?: number;
  frameRate?: number;
  timeZone?: string;
}

const rows: Row[] = [
  { key: 'text', field: schema('sg_department', 'Department', 'text'), value: 'lighting' },
  {
    key: 'list',
    field: schema('sg_version_type', 'Version Type', 'list', {
      validValues: ['Type A', 'Type B', 'Type C'],
    }),
    value: 'Type A',
  },
  { key: 'number', field: schema('frame_count', 'Frame Count', 'number'), value: 1001 },
  {
    key: 'float',
    field: schema('sg_movie_aspect_ratio', 'Movie Aspect Ratio', 'float'),
    value: '1.777778',
    precision: 2,
  },
  { key: 'percent', field: schema('sg___complete', 'Complete', 'percent'), value: 50 },
  { key: 'currency', field: schema('sg_bid', 'Bid', 'currency'), value: 12500 },
  { key: 'duration', field: schema('sg_bid___total', 'Bid Total', 'duration'), value: 480 },
  {
    key: 'timecode',
    field: schema('sg_timecode', 'Timecode', 'timecode'),
    value: 3600000,
    frameRate: 23.976,
  },
  { key: 'date', field: schema('sg_turnover_date', 'Turnover Date', 'date'), value: '2026-09-02' },
  {
    key: 'date_time',
    field: schema('client_approved_at', 'Client Approved At', 'date_time'),
    value: '2026-03-04T13:06:07Z',
    timeZone: 'America/Los_Angeles',
  },
  { key: 'checkbox', field: schema('flagged', 'Flagged', 'checkbox'), value: true },
  {
    key: 'url',
    field: schema('sg_uploaded_movie', 'Uploaded Movie', 'url'),
    value: { url: 'https://example.com/plate.mov', name: 'plate.mov', link_type: 'web' },
  },
  { key: 'color', field: schema('color', 'Gantt Bar Color', 'color'), value: 'pipeline_step' },
  { key: 'status_list', field: schema('sg_status_list', 'Status', 'status_list'), value: 'ip' },
  {
    key: 'entity',
    field: schema('entity', 'Link', 'entity', { validTypes: ['Shot'] }),
    value: { type: 'Shot', id: 1234, name: 'sh010_0010' },
  },
  {
    key: 'multi_entity',
    field: schema('sg_shots', 'Shots', 'multi_entity', { validTypes: ['Shot'] }),
    value: [{ type: 'Shot', id: 1234, name: 'sh010_0010' }],
  },
];

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';
const toggle =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-input bg-background px-2 text-sm shadow-xs whitespace-nowrap ' +
  'text-muted-foreground transition-colors duration-150 ease-out hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background active:scale-[0.98]';

export default function FieldEditorDemo() {
  const context = getDemoContext();
  const [values, setValues] = useState<Record<string, unknown>>(
    Object.fromEntries(rows.map((row) => [row.key, row.value])),
  );
  const [modes, setModes] = useState<Record<string, 'display' | 'edit'>>(
    Object.fromEntries(rows.map((row) => [row.key, 'display' as const])),
  );

  const allEditing = rows.every((row) => modes[row.key] === 'edit');

  const setAll = (mode: 'display' | 'edit'): void => {
    setModes(Object.fromEntries(rows.map((row) => [row.key, mode])));
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={toggle}
          data-demo-toggle
          aria-pressed={allEditing}
          onClick={() => setAll(allEditing ? 'display' : 'edit')}
        >
          {allEditing ? 'Show values' : 'Edit every field'}
        </button>
        <span className="text-muted-foreground text-xs">
          Click a value or press Enter on it to edit. Enter commits, Escape cancels.
        </span>
      </div>
      <table className="w-full table-fixed border-collapse text-left">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-border border-b last:border-b-0">
              <th scope="row" className={typeCell}>
                {row.field.dataType}
              </th>
              <td className={cell}>
                <div className="flex w-full min-w-0 flex-col gap-2">
                  <FieldEditor
                    value={values[row.key]}
                    onValueChange={(next) => setValues((all) => ({ ...all, [row.key]: next }))}
                    mode={modes[row.key]}
                    onModeChange={(next) => setModes((all) => ({ ...all, [row.key]: next }))}
                    field={row.field}
                    editable
                    context={context}
                    precision={row.precision}
                    frameRate={row.frameRate}
                    timeZone={row.timeZone}
                    data-demo-field={row.key}
                  />
                  <p className={valueCell} data-demo-value={row.key}>{JSON.stringify(values[row.key])}</p>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
