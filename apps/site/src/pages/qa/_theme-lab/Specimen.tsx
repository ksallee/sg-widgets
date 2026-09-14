/**
 * The theme lab specimen: the shadcn primitives and the raw token surfaces, so an edit in
 * the lab reads on real controls.
 */
import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import type { EntityRef } from '@sg-widgets/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { TextEditor } from '@/registry/sg/components/text-editor';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { REMOVE_CONTROL, type ChipSize } from '@/registry/sg/components/leaf-classes';
import { PICKER_CHIP, PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX, PICKER_TEXT_CHIP_CROSS } from '@/registry/sg/components/picker-classes';
import { cn } from '@/lib/utils';

const token = (name: string) => `var(--${name})`;

const BUTTONS = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
const BADGES = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
const SURFACES = [
  ['background', 'foreground', 'Page'],
  ['card', 'card-foreground', 'Card'],
  ['popover', 'popover-foreground', 'Popover'],
  ['muted', 'foreground', 'Muted'],
] as const;
const ROLES = ['destructive', 'success', 'warning', 'info'] as const;
const PEOPLE = ['Ada Lovelace', 'Anna van der Meer', 'j.doe'];
const BUTTON_SIZES = ['xs', 'sm', 'default', 'lg'] as const;
const ICON_SIZES = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const;
const TOGGLE_SIZES = ['sm', 'default', 'lg'] as const;
const PAIR_SIZES = ['sm', 'default'] as const;
const CONTROL_SIZES = ['sm', 'md', 'lg'] as const;
const TYPES = ['Shot', 'Asset', 'Sequence'];
const CHIP_ENTITIES: EntityRef[] = [
  { type: 'Shot', id: 862, name: 'sh010_0010' },
  { type: 'Asset', id: 1226, name: 'charAda' },
  { type: 'HumanUser', id: 20, name: 'Ada Lovelace' },
];

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tl-panel">
      <h3 className="tl-h">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Every chip step, from `xs` to `lg`: entity chips with their glyph, one with a cross, and the
 * text chip a code or a list value wears. A picker gives its chips the step under it, so the
 * steps come from `PICKER_CHIP`; `lg` only stands alone, where no text chip is drawn.
 */
function Chips() {
  const steps: { step: ChipSize; where: string; picker: (typeof CONTROL_SIZES)[number] | null }[] = [
    ...CONTROL_SIZES.map((picker) => ({ step: PICKER_CHIP[picker], where: `${picker} picker`, picker })),
    { step: 'lg', where: 'standalone', picker: null },
  ];
  return (
    <div className="tl-sizes">
      {steps.map(({ step, where, picker }) => (
        <div key={step} className="tl-size-row">
          <span className="tl-size-label">
            {step} · {where}
          </span>
          <div className="tl-wrap">
            {CHIP_ENTITIES.map((entity) => (
              <EntityChip key={entity.id} entity={entity} size={step} />
            ))}
            <EntityChip
              entity={CHIP_ENTITIES[1]!}
              size={step}
              removable
              onRemove={() => undefined}
              removeLabel="Remove charAda"
            />
            {picker
              ? TYPES.map((code) => (
                  <span key={code} data-chip="" className={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX[picker])}>
                    <span className="truncate">{code}</span>
                    <button type="button" aria-label={`Remove ${code}`} className={REMOVE_CONTROL}>
                      <X aria-hidden="true" className={PICKER_TEXT_CHIP_CROSS[picker]} />
                    </button>
                  </span>
                ))
              : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Every size a primitive offers, and the sm/md/lg ladder the widgets use. */
function Sizes() {
  const [picked, setPicked] = useState<Record<string, string>>({ sm: 'Shot', default: 'Asset' });
  const [text, setText] = useState<Record<string, string | null>>({ sm: 'sh010_0010', md: 'sh010_0010', lg: 'sh010_0010' });
  const row = (label: string, children: ReactNode) => (
    <div className="tl-size-row">
      <span className="tl-size-label">{label}</span>
      {children}
    </div>
  );
  return (
    <div className="tl-sizes">
      {row(
        'Button',
        <div className="tl-wrap">
          {BUTTON_SIZES.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
        </div>,
      )}
      {row(
        'Button, outline',
        <div className="tl-wrap">
          {BUTTON_SIZES.map((size) => (
            <Button key={size} size={size} variant="outline">
              {size}
            </Button>
          ))}
        </div>,
      )}
      {row(
        'Icon button',
        <div className="tl-wrap">
          {ICON_SIZES.map((size) => (
            <Button key={size} size={size} variant="outline" aria-label={size} title={size}>
              <Plus />
            </Button>
          ))}
        </div>,
      )}
      {row(
        'Toggle',
        <div className="tl-wrap">
          {TOGGLE_SIZES.map((size) => (
            <Toggle key={size} size={size} variant="outline" defaultPressed={size === 'default'}>
              {size}
            </Toggle>
          ))}
        </div>,
      )}
      {row(
        'Select',
        <div className="tl-wrap">
          {PAIR_SIZES.map((size) => (
            <Select
              key={size}
              value={picked[size]}
              onValueChange={(value) => {
                if (typeof value === 'string') setPicked((current) => ({ ...current, [size]: value }));
              }}
            >
              <SelectTrigger size={size} aria-label={`Select, ${size}`} className="w-auto" style={{ minWidth: '7rem' }}>
                <span data-slot="select-value">
                  {picked[size]} ({size})
                </span>
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>,
      )}
      {row(
        'Switch',
        <div className="tl-wrap">
          {PAIR_SIZES.map((size) => (
            <label key={size} className="tl-inline">
              <Switch size={size} defaultChecked /> {size}
            </label>
          ))}
        </div>,
      )}
      {row(
        'Input',
        <div className="tl-wrap">
          <Input placeholder="One size only" style={{ maxWidth: '14rem' }} />
        </div>,
      )}
      {row(
        'Editor, filled',
        <div className="tl-trio">
          {CONTROL_SIZES.map((size) => (
            <TextEditor
              key={size}
              size={size}
              value={text[size] ?? null}
              placeholder={`Empty, ${size}`}
              onValueChange={(value) => setText((current) => ({ ...current, [size]: value }))}
            />
          ))}
        </div>,
      )}
      {row(
        'Editor, empty',
        <div className="tl-trio">
          {CONTROL_SIZES.map((size) => (
            <TextEditor key={size} size={size} value={null} placeholder={`Type here, ${size}`} />
          ))}
        </div>,
      )}
    </div>
  );
}

export default function Specimen() {
  return (
    <div className="tl-spec">
      <Panel title="Surfaces and text">
        <div className="tl-tiles">
          {SURFACES.map(([surface, text, label]) => (
            <div key={surface} className="tl-tile" style={{ background: token(surface), color: token(text) }}>
              <strong>{label}</strong>
              <span>Body text on --{surface}.</span>
              <span style={{ color: token('muted-foreground') }}>Muted caption, 12 items</span>
              <span className="tl-chip" style={{ background: token('secondary'), color: token('secondary-foreground') }}>
                charAda
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Buttons">
        <div className="tl-wrap">
          {BUTTONS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button disabled>disabled</Button>
          <Button size="sm" variant="outline">
            small
          </Button>
        </div>
      </Panel>

      <Panel title="Sizes">
        <Sizes />
      </Panel>

      <Panel title="Badges">
        <div className="tl-wrap">
          {BADGES.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </Panel>

      <Panel title="Chips">
        <Chips />
      </Panel>

      <Panel title="Fields">
        <div className="tl-form">
          <div className="tl-field">
            <Label htmlFor="tl-empty">Empty</Label>
            <Input id="tl-empty" placeholder="Search for a person" />
          </div>
          <div className="tl-field">
            <Label htmlFor="tl-filled">Filled</Label>
            <Input id="tl-filled" defaultValue="sh010_0010_comp_v001" />
          </div>
          <div className="tl-field">
            <Label htmlFor="tl-invalid">Invalid</Label>
            <Input id="tl-invalid" aria-invalid defaultValue="not an email" />
          </div>
          <div className="tl-field">
            <Label htmlFor="tl-disabled">Disabled</Label>
            <Input id="tl-disabled" disabled defaultValue="Read only" />
          </div>
          <div className="tl-field tl-span">
            <Label htmlFor="tl-notes">Notes</Label>
            <Textarea id="tl-notes" placeholder="Write a note" />
          </div>
          <div className="tl-wrap tl-span">
            <label className="tl-inline">
              <Checkbox defaultChecked /> Checked
            </label>
            <label className="tl-inline">
              <Checkbox /> Unchecked
            </label>
            <label className="tl-inline">
              <Switch defaultChecked /> On
            </label>
            <label className="tl-inline">
              <Switch /> Off
            </label>
            <span className="tl-inline">
              Search <Kbd>⌘K</Kbd>
            </span>
          </div>
        </div>
      </Panel>

      <Panel title="A list: resting, selected, focused">
        <div className="tl-list">
          {PEOPLE.map((person, i) => (
            <div
              key={person}
              className="tl-item"
              style={i === 1 ? { background: token('accent'), color: token('accent-foreground') } : undefined}
            >
              {person}
              {i === 1 ? <span style={{ color: token('muted-foreground') }}>selected</span> : null}
            </div>
          ))}
          <Separator />
          <div className="tl-item tl-focus">Focus ring on --ring</div>
        </div>
      </Panel>

      <Panel title="Status roles">
        <div className="tl-wrap">
          {ROLES.map((role) => (
            <span key={role} className="tl-role" style={{ background: token(role), color: token(`${role}-foreground`) }}>
              {role}
            </span>
          ))}
        </div>
        <div className="tl-wrap">
          {ROLES.map((role) => (
            <span key={role} className="tl-role tl-soft" style={{ color: token(role), borderColor: token(role) }}>
              {role} text
            </span>
          ))}
        </div>
      </Panel>

      <Panel title="Charts">
        <div className="tl-bars">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} title={`--chart-${n}`} style={{ background: token(`chart-${n}`), height: `${40 + n * 11}%` }} />
          ))}
        </div>
      </Panel>

      <Panel title="Sidebar">
        <div
          className="tl-list"
          style={{ background: token('sidebar'), color: token('sidebar-foreground'), borderColor: token('sidebar-border') }}
        >
          <span className="tl-item" style={{ background: token('sidebar-primary'), color: token('sidebar-primary-foreground') }}>
            Current page
          </span>
          <span className="tl-item" style={{ background: token('sidebar-accent'), color: token('sidebar-accent-foreground') }}>
            Hovered
          </span>
          <span className="tl-item">Resting</span>
        </div>
      </Panel>
    </div>
  );
}
