import { useState } from 'react';
import { NumberEditor } from '@/registry/sg/components/number-editor';

const cell = 'px-3 py-2 align-top';
const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
const valueCell = 'text-muted-foreground truncate font-mono text-xs';

export default function NumberEditorDemo() {
  const [frameCount, setFrameCount] = useState<number | string | null>(1001);
  const [ratio, setRatio] = useState<number | string | null>('1.777778');
  const [complete, setComplete] = useState<number | string | null>(50);
  const [bid, setBid] = useState<number | string | null>(12500);
  const [duration, setDuration] = useState<number | string | null>(480);
  const [days, setDays] = useState<number | string | null>(480);
  const [timecode, setTimecode] = useState<number | string | null>(3600000);
  const [cut, setCut] = useState<number | string | null>(75);

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            number
          </th>
          <td className={cell}>
            <div data-demo-field="number" className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor
                value={frameCount}
                onValueChange={setFrameCount}
                dataType="number"
                field={{ displayName: 'Frame Count', mandatory: false }}
              />
              <p data-demo-value="number" className={valueCell}>
                {JSON.stringify(frameCount)}
              </p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            float, step 0.1
          </th>
          <td className={cell}>
            <div data-demo-field="float" className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor
                value={ratio}
                onValueChange={setRatio}
                dataType="float"
                precision={2}
                field={{ displayName: 'Aspect Ratio', mandatory: false }}
              />
              <p data-demo-value="float" className={valueCell}>
                {JSON.stringify(ratio)}
              </p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            percent, 0 to 100
          </th>
          <td className={cell}>
            <div data-demo-field="percent" className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor
                value={complete}
                onValueChange={setComplete}
                dataType="percent"
                min={0}
                max={100}
                field={{ displayName: 'Complete', mandatory: false }}
              />
              <p data-demo-value="percent" className={valueCell}>
                {JSON.stringify(complete)}
              </p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            currency
          </th>
          <td className={cell}>
            <div data-demo-field="currency" className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor
                value={bid}
                onValueChange={setBid}
                dataType="currency"
                symbol="$"
                precision={2}
                field={{ displayName: 'Bid', mandatory: false }}
              />
              <p data-demo-value="currency" className={valueCell}>
                {JSON.stringify(bid)}
              </p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            duration, step 15m
          </th>
          <td className={cell}>
            <div data-demo-field="duration" className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor
                value={duration}
                onValueChange={setDuration}
                dataType="duration"
                hint
                field={{ displayName: 'Bid Duration', mandatory: false }}
              />
              <p data-demo-value="duration" className={valueCell}>
                {JSON.stringify(duration)}
              </p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            duration, 6h day, scrub
          </th>
          <td className={cell}>
            <div data-demo-field="days" className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor
                value={days}
                onValueChange={setDays}
                dataType="duration"
                hoursPerDay={6}
                scrub
                label="Time Logged"
                field={{ displayName: 'Time Logged', mandatory: false }}
              />
              <p data-demo-value="days" className={valueCell}>
                {JSON.stringify(days)}
              </p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            timecode, 23.976
          </th>
          <td className={cell}>
            <div data-demo-field="timecode" className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor
                value={timecode}
                onValueChange={setTimecode}
                dataType="timecode"
                frameRate={23.976}
                field={{ displayName: 'Head In', mandatory: false }}
              />
              <p data-demo-value="timecode" className={valueCell}>
                {JSON.stringify(timecode)}
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            inline, size sm
          </th>
          <td className={cell}>
            <div data-demo-field="inline" className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor
                value={cut}
                onValueChange={setCut}
                dataType="percent"
                inline
                size="sm"
                field={{ displayName: 'Cut Duration', mandatory: false }}
              />
              <p data-demo-value="inline" className={valueCell}>
                {JSON.stringify(cut)}
              </p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
