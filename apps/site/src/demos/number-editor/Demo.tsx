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

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <tbody>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            number
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor value={frameCount} onValueChange={setFrameCount} dataType="number" />
              <p className={valueCell}>{JSON.stringify(frameCount)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            float, precision 2
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor value={ratio} onValueChange={setRatio} dataType="float" precision={2} />
              <p className={valueCell}>{JSON.stringify(ratio)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            percent
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor value={complete} onValueChange={setComplete} dataType="percent" min={0} max={100} />
              <p className={valueCell}>{JSON.stringify(complete)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            currency
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor value={bid} onValueChange={setBid} dataType="currency" symbol="$" precision={2} />
              <p className={valueCell}>{JSON.stringify(bid)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            duration
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor value={duration} onValueChange={setDuration} dataType="duration" />
              <p className={valueCell}>{JSON.stringify(duration)}</p>
            </div>
          </td>
        </tr>
        <tr className="border-border border-b">
          <th scope="row" className={typeCell}>
            duration, 6h day
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor value={days} onValueChange={setDays} dataType="duration" hoursPerDay={6} />
              <p className={valueCell}>{JSON.stringify(days)}</p>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row" className={typeCell}>
            timecode, 23.976
          </th>
          <td className={cell}>
            <div className="flex w-full min-w-0 flex-col gap-2">
              <NumberEditor value={timecode} onValueChange={setTimecode} dataType="timecode" frameRate={23.976} />
              <p className={valueCell}>{JSON.stringify(timecode)}</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
