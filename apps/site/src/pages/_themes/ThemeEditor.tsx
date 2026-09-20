/**
 * The Themes page editor: start from a shipped palette or a pasted theme, adjust the
 * few values that carry a theme, and take it away as CSS or keep it as the palette every
 * page wears.
 *
 * The preview stages beside it wear the theme through one style tag, rewritten on every
 * change. Nothing here writes a file.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { palettes } from '../../components/demo-prefs';
import { formatOklch, ratio, toHex } from '../../theme/color';
import { adjust, backgroundHue, backgroundTint, noAdjustments, radiusOf, withStatus, type Adjustments } from '../../theme/adjust';
import { clearCustom, readCustom, saveCustom } from '../../theme/custom';
import { FONT_LINK, themeFontsHref } from '../../theme/fonts';
import { applyFontLink, applyStyle } from '../../theme/live';
import { ThemeParseError, parseTheme } from '../../theme/parse';
import { presetTheme } from '../../theme/presets';
import { previewCss, shadcnCss, slugify, themesCss } from '../../theme/serialise';
import { AA, STATUS_ROLES, meetAA, type StatusRole } from '../../theme/status';
import { MODES, colorOf, type Mode, type Theme } from '../../theme/theme';

/** The style tag the two preview stages read. */
const PREVIEW_STYLE = 'sg-theme-preview';

const REM = /^([\d.]+)rem$/;
const remOf = (value: string): number => Number(REM.exec(value.trim())?.[1] ?? 0.625);
const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

const hexOf = (theme: Theme, mode: Mode, name: string): string => {
  const color = colorOf(theme[mode], name);
  return color ? toHex(color) : '#000000';
};

export default function ThemeEditor() {
  const stored = useRef(readCustom()).current;
  const [preset, setPreset] = useState(stored ? 'custom' : 'default');
  const [base, setBase] = useState<Theme>(() => withStatus(stored?.theme ?? presetTheme('default')));
  const [edits, setEdits] = useState<Adjustments>(noAdjustments);
  const [mode, setMode] = useState<Mode>('light');
  const [paste, setPaste] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(stored?.label ?? 'My theme');
  const [saved, setSaved] = useState(stored !== null);
  const [copied, setCopied] = useState<string | null>(null);

  const theme = useMemo(() => adjust(base, edits), [base, edits]);
  const slug = slugify(name) || 'custom';

  useEffect(() => {
    applyStyle(PREVIEW_STYLE, previewCss(theme));
    applyFontLink(FONT_LINK, themeFontsHref(theme));
  }, [theme]);

  const start = (next: Theme, from: string): void => {
    setBase(withStatus(next));
    setEdits(noAdjustments());
    setPreset(from);
    setError(null);
  };

  const use = (): void => {
    try {
      start(parseTheme(paste), 'pasted');
    } catch (problem) {
      setError(problem instanceof ThemeParseError ? problem.message : String(problem));
    }
  };

  const edit = (patch: Partial<Adjustments>): void => setEdits((current) => ({ ...current, ...patch }));
  const editPrimary = (hex: string): void => setEdits((current) => ({ ...current, primary: { ...current.primary, [mode]: hex } }));
  const editStatus = (role: StatusRole, hex: string): void =>
    setEdits((current) => ({ ...current, status: { ...current.status, [mode]: { ...current.status[mode], [role]: hex } } }));

  /** The three roles of this mode, each walked until it clears AA on the ink it is read on. */
  const walkToAA = (): void => {
    const walked: Partial<Record<StatusRole, string>> = {};
    for (const role of STATUS_ROLES) {
      const color = colorOf(theme[mode], `--${role}`);
      const foreground = colorOf(theme[mode], `--${role}-foreground`);
      if (color && foreground) walked[role] = formatOklch(meetAA(color, foreground));
    }
    setEdits((current) => ({ ...current, status: { ...current.status, [mode]: { ...current.status[mode], ...walked } } }));
  };

  const exports: [string, string][] = [
    ['For a host stylesheet', shadcnCss(theme)],
    ['For src/styles/themes.css', themesCss(theme, slug)],
  ];

  async function copy(title: string, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(title);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null); // No clipboard: the block is selectable.
    }
  }

  return (
    <div className="th-editor" data-th="editor">
      <p className="th-lead">
        Design a theme in <a href="https://tweakcn.com">tweakcn</a>. Press Code at the top right of its editor, copy the whole
        stylesheet, and paste it here. <a href="https://ui.shadcn.com/docs/theming">shadcn's theming guide</a> says what the
        tokens are.
      </p>

      <section className="th-group">
        <h2 className="th-h">Start from</h2>
        <label className="th-field">
          <span className="th-label">Palette</span>
          <select
            className="th-in"
            data-th="preset"
            value={preset}
            onChange={(event) => start(presetTheme(event.target.value), event.target.value)}
          >
            {preset === 'pasted' && <option value="pasted">Pasted</option>}
            {preset === 'custom' && <option value="custom">{name}</option>}
            {palettes.map((palette) => (
              <option key={palette.name} value={palette.name}>
                {palette.label}
              </option>
            ))}
          </select>
        </label>
        <label className="th-field">
          <span className="th-label">Paste a theme</span>
          <textarea
            className="th-in th-paste"
            data-th="paste"
            rows={4}
            spellCheck={false}
            placeholder={':root { --background: oklch(1 0 0); ... } .dark { ... }, or the JSON a registry serves'}
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
          />
          <span className="th-label">
            The preview reads the colours, the radius, the fonts and the shadows. Every other token in the paste is kept and
            comes back in the export.
          </span>
        </label>
        <div className="th-row">
          <Button size="sm" data-th="use" onClick={use}>
            Use this theme
          </Button>
          {error && (
            <p className="th-error" data-th="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="th-group">
        <div className="th-row th-between">
          <h2 className="th-h">Adjust</h2>
          <div className="th-seg" role="group" aria-label="Mode">
            {MODES.map((one) => (
              <Button
                key={one}
                size="sm"
                variant={one === mode ? 'default' : 'outline'}
                aria-pressed={one === mode}
                data-th={`mode-${one}`}
                onClick={() => setMode(one)}
              >
                {one === 'light' ? 'Light' : 'Dark'}
              </Button>
            ))}
          </div>
        </div>

        <label className="th-field th-inline">
          <span className="th-label">Primary</span>
          <input
            type="color"
            className="th-color"
            data-th="primary"
            value={hexOf(theme, mode, '--primary')}
            onChange={(event) => editPrimary(event.target.value)}
          />
          <code className="th-value">{theme[mode]['--primary']}</code>
        </label>

        <Slider
          label="Background hue"
          min={0}
          max={360}
          step={1}
          value={edits.hue ?? backgroundHue(base)}
          onChange={(value) => edit({ hue: value })}
          readout={`${trim(edits.hue ?? backgroundHue(base), 0)}°`}
        />
        <Slider
          label="Background tint"
          min={0}
          max={0.06}
          step={0.002}
          value={edits.tint ?? backgroundTint(base, mode)}
          onChange={(value) => edit({ tint: value })}
          readout={trim(edits.tint ?? backgroundTint(base, mode), 3)}
        />
        <Slider
          label="Radius"
          min={0}
          max={1.5}
          step={0.025}
          value={remOf(edits.radius ?? radiusOf(base))}
          onChange={(value) => edit({ radius: `${trim(value, 3)}rem` })}
          readout={edits.radius ?? radiusOf(base)}
        />

        <div className="th-row th-between">
          <h3 className="th-label">Status roles, from the destructive colour</h3>
          <Button size="sm" variant="outline" data-th="meet-aa" onClick={walkToAA}>
            Meet AA
          </Button>
        </div>
        {STATUS_ROLES.map((role) => (
          <StatusRow key={role} role={role} theme={theme} mode={mode} onChange={(hex) => editStatus(role, hex)} />
        ))}
      </section>

      <section className="th-group">
        <h2 className="th-h">Save</h2>
        <p className="th-label">A saved theme joins the palette select and every page wears it.</p>
        <label className="th-field th-two">
          <span className="th-label">Name</span>
          <Input className="th-in" data-th="name" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="th-row">
          <Button
            size="sm"
            data-th="save"
            onClick={() => {
              saveCustom(theme, name.trim() || 'Custom');
              setSaved(true);
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-th="remove"
            disabled={!saved}
            onClick={() => {
              clearCustom();
              setSaved(false);
            }}
          >
            Remove
          </Button>
          <span className="th-label" data-th="saved-state">
            {saved ? `Saved as ${name}` : 'Not saved'}
          </span>
        </div>
      </section>

      <section className="th-group">
        <h2 className="th-h">Export</h2>
        {exports.map(([title, text]) => (
          <div className="th-field" key={title}>
            <div className="th-row th-between">
              <span className="th-label">{title}</span>
              <Button size="sm" variant="outline" onClick={() => void copy(title, text)}>
                {copied === title ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="th-out" data-th={title === 'For a host stylesheet' ? 'export-shadcn' : 'export-themes'}>
              {text}
            </pre>
          </div>
        ))}
      </section>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  readout,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  readout: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="th-field th-slider">
      <span className="th-label">{label}</span>
      <input
        type="range"
        className="th-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <code className="th-value">{readout}</code>
    </label>
  );
}

function StatusRow({
  role,
  theme,
  mode,
  onChange,
}: {
  role: StatusRole;
  theme: Theme;
  mode: Mode;
  onChange: (hex: string) => void;
}) {
  const color = colorOf(theme[mode], `--${role}`);
  const foreground = colorOf(theme[mode], `--${role}-foreground`);
  const reads = color && foreground ? ratio(color, foreground) : null;
  return (
    <div className="th-field th-inline" data-th={`status-${role}`}>
      <span className="th-label th-role">{role}</span>
      <input
        type="color"
        className="th-color"
        data-th={`status-${role}-color`}
        value={color ? toHex(color) : '#000000'}
        onChange={(event) => onChange(event.target.value)}
      />
      <code className="th-value" data-th={`status-${role}-value`}>
        {color ? formatOklch(color) : '—'}
      </code>
      <span className="th-ratio" data-th={`status-${role}-ratio`} data-fail={reads !== null && reads < AA ? '' : undefined}>
        {reads === null ? '—' : `${reads.toFixed(2)}:1 ${reads >= AA ? 'AA' : 'under AA'}`}
      </span>
    </div>
  );
}
