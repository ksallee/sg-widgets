import { useState } from 'react';
import { ColorEditor } from '@/registry/sg/components/color-editor';

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function ColorEditorDemo() {
  const [step, setStep] = useState<string | null>('253,94,99');
  const [project, setProject] = useState<string | null>('0,126,174');
  const [task, setTask] = useState<string | null>('pipeline_step');

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            triple
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <ColorEditor value={step} onValueChange={setStep} field={{ displayName: 'Color', mandatory: false }} />
              <p className={valueCell}>{JSON.stringify(step)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            hex accepted
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <ColorEditor
                value={project}
                onValueChange={setProject}
                placeholder="#ff8000"
                field={{ displayName: 'Color', mandatory: false }}
              />
              <p className={valueCell}>{JSON.stringify(project)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            pipeline step
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <ColorEditor
                value={task}
                onValueChange={setTask}
                field={{ displayName: 'Gantt Bar Color', mandatory: false }}
              />
              <p className={valueCell}>{JSON.stringify(task)}</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            disabled
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <ColorEditor value="45,45,45" disabled />
              <p className={valueCell}>"45,45,45"</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
