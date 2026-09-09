import { useState } from 'react';
import type { UrlValue } from '@sg-widgets/core';
import { UrlEditor } from '@/registry/sg/components/url-editor';

const local: UrlValue = {
  link_type: 'local',
  name: 'plate.exr',
  local_path_mac: '/Volumes/shows/sh010/plate.exr',
};

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function UrlEditorDemo() {
  const [web, setWeb] = useState<UrlValue | null>({
    url: 'https://example.com/plate.mov',
    name: 'plate.mov',
    link_type: 'web',
  });
  const [blank, setBlank] = useState<UrlValue | null>(null);

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            web link
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <UrlEditor
                value={web}
                onValueChange={setWeb}
                field={{ displayName: 'Uploaded Movie', mandatory: false }}
              />
              <p className={valueCell}>{JSON.stringify(web)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            unset
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <UrlEditor value={blank} onValueChange={setBlank} />
              <p className={valueCell}>{JSON.stringify(blank)}</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            local path
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <UrlEditor value={local} />
              <p className={valueCell}>{JSON.stringify(local)}</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
