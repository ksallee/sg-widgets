/**
 * The theme lab editor: every colour token of the root theme, in oklch, applied live to
 * the page and the demos beside it, and written back as the two global.css blocks.
 *
 * Nothing here writes a file.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CONTRAST,
  GROUPS,
  MODES,
  contrast,
  followsByDefault,
  formatRem,
  over,
  overrideCss,
  parseOklch,
  readBlocks,
  readRadius,
  renderBlock,
  resolve,
  toSrgb,
  wantedRatio,
  type Base,
  type Block,
  type Edit,
  type Mode,
  type Oklch,
  type Resolved,
  type Rgb,
} from './tokens';

const STORE = 'theme-lab:v1';
const STYLE_ID = 'theme-lab-overrides';
/** Rows that get a lightness slider under their fields. */
const LIGHTNESS_SLIDERS = new Set(['--foreground']);
const px = (rem: number) => Number((rem * 16).toFixed(1));
const HUE_TRACK = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => `oklch(0.72 0.13 ${i * 30})`).join(', ')})`;

interface Saved {
  mode: Mode;
  h: number | null;
  radius: number | null;
  c: Record<Mode, number | null>;
  apply: Record<Mode, boolean | null>;
  edits: Record<Mode, Record<string, Edit>>;
}

function fresh(mode: Mode = 'light'): Saved {
  return { mode, h: null, radius: null, c: { light: null, dark: null }, apply: { light: null, dark: null }, edits: { light: {}, dark: {} } };
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return fresh();
    const stored = JSON.parse(raw) as Partial<Saved>;
    const base = fresh(stored.mode === 'dark' ? 'dark' : 'light');
    return {
      ...base,
      h: typeof stored.h === 'number' ? stored.h : null,
      radius: typeof stored.radius === 'number' ? stored.radius : null,
      c: { ...base.c, ...stored.c },
      apply: { ...base.apply, ...stored.apply },
      edits: { light: { ...stored.edits?.light }, dark: { ...stored.edits?.dark } },
    };
  } catch {
    return fresh();
  }
}

export default function ThemeLab() {
  const parsed = useMemo(() => {
    try {
      return { blocks: readBlocks() };
    } catch (error) {
      return { error: String(error) };
    }
  }, []);
  if ('error' in parsed) return <p className="tl-group">{parsed.error}</p>;
  return <Lab blocks={parsed.blocks} />;
}

function Lab({ blocks }: { blocks: Record<Mode, Block> }) {
  const [saved, setSaved] = useState<Saved>(load);
  const [copied, setCopied] = useState(false);
  const [outlines, setOutlines] = useState(() => {
    try {
      return localStorage.getItem('theme-lab:outlines') === '1';
    } catch {
      return false;
    }
  });
  const mode = saved.mode;
  const fileRadius = useMemo(() => readRadius(blocks), [blocks]);
  const radius = saved.radius ?? fileRadius?.rem ?? null;
  const radiusChanged = fileRadius !== null && radius !== null && formatRem(radius) !== formatRem(fileRadius.rem);
  const radiusValue = fileRadius === null || radius === null ? null : radiusChanged ? formatRem(radius) : fileRadius.source;

  const bases = useMemo(() => {
    const backgroundOf = (m: Mode) => blocks[m].tokens.find((t) => t.name === '--background')?.color ?? null;
    const light = backgroundOf('light');
    const fileH = light && light.c > 0 ? light.h : 285.2;
    const out = {} as Record<Mode, Base>;
    for (const m of MODES) {
      const fileC = backgroundOf(m)?.c ?? 0;
      out[m] = {
        h: saved.h ?? fileH,
        fileH,
        c: saved.c[m] ?? fileC,
        fileC,
        limit: Math.max(0.02, 2.5 * fileC),
        apply: saved.apply[m] ?? true,
      };
    }
    return out;
  }, [blocks, saved.h, saved.c, saved.apply]);

  const resolved = useMemo(() => {
    const lightTwin = new Map(blocks.light.tokens.map((token) => [token.name, token]));
    const out = {} as Record<Mode, Map<string, Resolved>>;
    for (const m of MODES) {
      out[m] = new Map();
      for (const token of blocks[m].tokens) {
        if (!token.color) continue;
        // Both modes lock the same rows: a token follows by default when its light twin does.
        const twin = lightTwin.get(token.name);
        const followDefault = twin?.color ? followsByDefault(twin, bases.light) : followsByDefault(token, bases[m]);
        out[m].set(token.name, resolve(token, saved.edits[m][token.name], bases[m], followDefault));
      }
    }
    return out;
  }, [blocks, bases, saved.edits]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(saved));
    } catch {
      // Blocked storage: the lab still works for this visit.
    }
  }, [saved]);

  useEffect(() => {
    let tag = document.getElementById(STYLE_ID);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = STYLE_ID;
      document.head.appendChild(tag);
    }
    tag.textContent = overrideCss({ light: resolved.light.values(), dark: resolved.dark.values() }, radiusChanged ? radiusValue : null);
  }, [resolved, radiusChanged, radiusValue]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    try {
      localStorage.setItem('sg-demo:theme', mode);
      window.dispatchEvent(new StorageEvent('storage'));
    } catch {
      // The stages also follow data-theme on the root.
    }
  }, [mode]);

  useEffect(() => {
    document.body.classList.toggle('tl-outlines', outlines);
    try {
      localStorage.setItem('theme-lab:outlines', outlines ? '1' : '0');
    } catch {
      // The outlines still show for this visit.
    }
  }, [outlines]);

  const output = useMemo(
    () =>
      MODES.map((m) => {
        const values = new Map([...resolved[m].values()].map((row) => [row.token.name, row.value]));
        if (m === 'light' && radiusValue !== null) values.set('--radius', radiusValue);
        return renderBlock(blocks[m], values);
      }).join('\n\n'),
    [blocks, resolved, radiusValue],
  );

  const current = resolved[mode];
  const base = bases[mode];
  const differs = (m: Mode) => [...resolved[m].values()].filter((row) => row.changed).length;

  const setBase = (patch: { h?: number; c?: number; apply?: boolean }) =>
    setSaved((s) => ({
      ...s,
      h: patch.h ?? s.h,
      c: patch.c === undefined ? s.c : { ...s.c, [s.mode]: patch.c },
      apply: patch.apply === undefined ? s.apply : { ...s.apply, [s.mode]: patch.apply },
    }));

  const edit = (name: string, patch: Edit | null) =>
    setSaved((s) => {
      const next = { ...s.edits[s.mode] };
      if (patch) next[name] = { ...next[name], ...patch };
      else delete next[name];
      return { ...s, edits: { ...s.edits, [s.mode]: next } };
    });

  const paint = (name: string, under: Rgb) => {
    const row = current.get(name);
    if (!row) return null;
    const { rgb, inGamut } = toSrgb(row.color);
    return { rgb: row.color.a < 1 ? over(rgb, row.color.a, under) : rgb, inGamut };
  };
  const page: Rgb = paint('--background', [1, 1, 1])?.rgb ?? [1, 1, 1];
  const ratios = (name: string) =>
    (CONTRAST[name] ?? []).flatMap((surface) => {
      const under = paint(surface, page);
      const text = under && paint(name, under.rgb);
      return under && text ? [{ surface: surface.slice(2), ratio: contrast(text.rgb, under.rgb) }] : [];
    });

  const known = new Set(GROUPS.flatMap(([, names]) => names));
  const groups = [
    ...GROUPS.map(([title, names]) => [title, names.filter((name) => current.has(name))] as const),
    ['Other', [...current.keys()].filter((name) => !known.has(name))] as const,
  ].filter(([, names]) => names.length > 0);

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      const area = document.querySelector<HTMLTextAreaElement>('[data-tl="output"]');
      area?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="tl-lab">
      <div className="tl-bar">
        <div className="tl-title">
          <strong>Theme lab</strong>
          <span>Edits apply to this page only. Copy the CSS at the bottom into src/styles/global.css to keep them.</span>
        </div>

        <div className="tl-line">
          <div className="tl-seg" role="group" aria-label="Mode">
            {MODES.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={m === mode ? 'default' : 'outline'}
                aria-pressed={m === mode}
                data-tl={`mode-${m}`}
                onClick={() => setSaved((s) => ({ ...s, mode: m }))}
              >
                {m === 'light' ? 'Light' : 'Dark'}
              </Button>
            ))}
          </div>
          <label className="tl-check">
            <input
              type="checkbox"
              data-tl="apply-base"
              checked={base.apply}
              onChange={(event) => {
                const apply = event.currentTarget.checked;
                setBase({ apply });
              }}
            />
            Tint the {mode} neutrals to the base
          </label>
          <label className="tl-check">
            <input
              type="checkbox"
              data-tl="outlines"
              checked={outlines}
              onChange={(event) => {
                const on = event.currentTarget.checked;
                setOutlines(on);
              }}
            />
            Outline icons and chips
          </label>
        </div>

        <div className="tl-control">
          <span className="tl-label">Base hue</span>
          <input
            type="range"
            className="tl-range"
            data-tl="base-hue"
            aria-label="Base hue"
            min={0}
            max={360}
            step={0.1}
            value={base.h}
            style={{ background: HUE_TRACK }}
            onChange={(event) => {
              const h = event.currentTarget.valueAsNumber;
              setBase({ h });
            }}
          />
          <NumField label="Base hue" value={base.h} digits={1} step={0.5} min={0} max={360} onChange={(h) => setBase({ h })} />
        </div>

        <div className="tl-control">
          <span className="tl-label">Neutral chroma</span>
          <input
            type="range"
            className="tl-range"
            data-tl="base-chroma"
            aria-label={`Neutral chroma, ${mode}`}
            min={0}
            max={0.06}
            step={0.0005}
            value={base.c}
            onChange={(event) => {
              const c = event.currentTarget.valueAsNumber;
              setBase({ c });
            }}
          />
          <NumField
            label={`Neutral chroma, ${mode}`}
            value={base.c}
            digits={4}
            step={0.001}
            min={0}
            max={0.4}
            onChange={(c) => setBase({ c })}
          />
        </div>

        {fileRadius !== null && radius !== null ? (
          <>
            <div className="tl-control">
              <span className="tl-label">Radius</span>
              <input
                type="range"
                className="tl-range"
                data-tl="radius"
                aria-label="Radius"
                min={0}
                max={1.5}
                step={0.0625}
                value={radius}
                onChange={(event) => {
                  const rem = event.currentTarget.valueAsNumber;
                  setSaved((s) => ({ ...s, radius: rem }));
                }}
              />
              <NumField
                label="Radius in rem"
                value={radius}
                digits={4}
                step={0.0625}
                min={0}
                max={3}
                onChange={(rem) => setSaved((s) => ({ ...s, radius: rem }))}
              />
            </div>
            <p className="tl-hint" data-tl="radius-steps">
              {formatRem(radius)} is {px(radius)}px. Buttons, inputs, selects and textareas take it whole ({px(radius)}px), pickers
              0.8× ({px(radius * 0.8)}px), badges 2.6× ({px(radius * 2.6)}px). The xs and sm buttons stop at 10px and 12px.
            </p>
          </>
        ) : null}

        <p className="tl-hint">
          Greys take the neutral chroma and tinted neutrals scale with it; both take the hue. Status, ring, chart and accent colours
          keep their own unless you tick them, and dark locks the same rows as light.
        </p>

        <div className="tl-line">
          <span className="tl-count" data-tl="differs">
            {differs('light')} light and {differs('dark')} dark tokens differ from global.css{radiusChanged ? ', and the radius' : ''}
          </span>
          <div className="tl-actions">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setSaved((s) => ({
                  ...s,
                  c: { ...s.c, [s.mode]: null },
                  apply: { ...s.apply, [s.mode]: null },
                  edits: { ...s.edits, [s.mode]: {} },
                }))
              }
            >
              Reset {mode}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSaved(fresh(mode))}>
              Reset all
            </Button>
            <Button size="sm" data-tl="copy" onClick={copy}>
              {copied ? 'Copied' : 'Copy CSS'}
            </Button>
          </div>
        </div>
      </div>

      {groups.map(([title, names]) => (
        <section key={title} className="tl-group">
          <h3 className="tl-h">{title}</h3>
          <div className="tl-head" aria-hidden="true">
            <span />
            <span>Token</span>
            <span>Base</span>
            <span>L</span>
            <span>C</span>
            <span>H</span>
            <span>Alpha</span>
            <span />
          </div>
          {names.map((name) => {
            const row = current.get(name)!;
            const wanted = wantedRatio(name);
            const inGamut = toSrgb(row.color).inGamut;
            return (
              <div key={name} className="tl-row" data-tl-token={name} data-changed={row.changed ? '' : undefined}>
                <span className="tl-swatch" title={`global.css: ${row.token.source}`}>
                  <span style={{ background: row.value }} />
                </span>
                <div className="tl-name">
                  <code>{name}</code>
                  <span className="tl-meta">
                    {ratios(name).map(({ surface, ratio }) => (
                      <span key={surface} data-fail={wanted !== null && ratio < wanted ? '' : undefined}>
                        {ratio.toFixed(2)}:1 on {surface}
                      </span>
                    ))}
                    {inGamut ? null : <span data-fail="">outside sRGB</span>}
                  </span>
                </div>
                <input
                  type="checkbox"
                  aria-label={`${name} follows the base`}
                  checked={row.followChecked}
                  disabled={!base.apply}
                  onChange={(event) => {
                    const follow = event.currentTarget.checked;
                    edit(name, { follow });
                  }}
                />
                <NumField label={`${name} lightness`} value={row.color.l} digits={4} step={0.005} min={0} max={1} onChange={(l) => edit(name, { l })} />
                <NumField
                  label={`${name} chroma`}
                  value={row.color.c}
                  digits={4}
                  step={0.001}
                  min={0}
                  max={0.4}
                  disabled={row.lockC}
                  onChange={(c) => edit(name, { c })}
                />
                <NumField
                  label={`${name} hue`}
                  value={row.color.h}
                  digits={2}
                  step={0.5}
                  min={0}
                  max={360}
                  disabled={row.lockH}
                  onChange={(h) => edit(name, { h })}
                />
                <NumField label={`${name} alpha`} value={row.color.a} digits={3} step={0.01} min={0} max={1} onChange={(a) => edit(name, { a })} />
                <button
                  type="button"
                  className="tl-revert"
                  aria-label={`Revert ${name}`}
                  title="Drop this row's edits"
                  disabled={!saved.edits[mode][name]}
                  onClick={() => edit(name, null)}
                >
                  ↺
                </button>
                {LIGHTNESS_SLIDERS.has(name) ? (
                  <input
                    type="range"
                    className="tl-range tl-slider"
                    data-tl={`lightness${name}`}
                    aria-label={`${name} lightness`}
                    min={0}
                    max={1}
                    step={0.001}
                    value={row.color.l}
                    style={{
                      background: `linear-gradient(to right, oklch(0 ${row.color.c} ${row.color.h}), oklch(1 ${row.color.c} ${row.color.h}))`,
                    }}
                    onChange={(event) => {
                      const l = event.currentTarget.valueAsNumber;
                      edit(name, { l });
                    }}
                  />
                ) : null}
                <ValueField name={name} value={row.value} onCommit={(color) => edit(name, { follow: false, ...color })} />
              </div>
            );
          })}
        </section>
      ))}

      <section className="tl-group">
        <h3 className="tl-h">CSS for global.css</h3>
        <textarea className="tl-out tl-mono" data-tl="output" readOnly spellCheck={false} value={output} />
      </section>
    </div>
  );
}

interface NumFieldProps {
  label: string;
  value: number;
  digits: number;
  step: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/** A number box that lets a half-typed value stand; arrows step, shift steps ten. */
function NumField({ label, value, digits, step, min, max, disabled = false, onChange }: NumFieldProps) {
  const shown = String(Number(value.toFixed(digits)));
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <input
      type="text"
      inputMode="decimal"
      className="tl-in"
      aria-label={label}
      value={draft ?? shown}
      disabled={disabled}
      onFocus={() => setDraft(shown)}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        const text = event.currentTarget.value;
        setDraft(text);
        const next = Number(text);
        if (text.trim() !== '' && Number.isFinite(next)) onChange(clamp(next));
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const next = clamp(value + (event.key === 'ArrowUp' ? step : -step) * (event.shiftKey ? 10 : 1));
        setDraft(String(Number(next.toFixed(digits))));
        onChange(next);
      }}
    />
  );
}

/** The whole value as CSS text; a pasted oklch() takes the row off the base. */
function ValueField({ name, value, onCommit }: { name: string; value: string; onCommit: (color: Oklch) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseOklch(draft) === null;
  return (
    <input
      type="text"
      className="tl-in tl-mono"
      aria-label={`${name} value`}
      spellCheck={false}
      value={draft ?? value}
      data-bad={invalid ? '' : undefined}
      onFocus={() => setDraft(value)}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        const text = event.currentTarget.value;
        setDraft(text);
        const color = parseOklch(text);
        if (color) onCommit(color);
      }}
    />
  );
}
