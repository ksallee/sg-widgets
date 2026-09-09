/**
 * In-memory `SgClient`.
 *
 * A fake site: rows, field schemas, statuses and icons shaped exactly as the REST
 * API returns them, so demos, tests and Storybook-style pages exercise the same
 * code paths as `RestClient`. Every quirk it reproduces is cited against the
 * sg-groundtruth corpus; where the mock is deliberately simpler than the site,
 * the comment says so.
 *
 * Fixtures are generated from a seed, so two runs produce identical ids, codes,
 * statuses and dates.
 */
import type {
  EntityRow,
  EntityTypeInfo,
  HierarchyNode,
  HierarchyPath,
  SearchOptions,
  SearchResult,
  SgClient,
  SummarizeOptions,
  SummarizeResult,
  SummaryGroup,
  TextSearchRow,
} from './client.js';
import { SgApiError } from './client.js';
import type { EntityRef, TextSearchFilter, WireCondition, WireGroup } from './filter.js';
import { toFilterArray } from './filter.js';
import type { Operator } from './field-types.js';
import { isFilterable, isLinkType, isNumericType, NEGATING_OPERATORS, operatorsFor } from './field-types.js';
import type { FieldSchema } from './schema.js';
import { displayNameOf } from './schema.js';
import type { StatusIcon, StatusRecord } from './status.js';

/* -------------------------------------------------------------------------- */
/* options                                                                    */
/* -------------------------------------------------------------------------- */

/** What the next call should throw instead of answering. */
export interface MockFailure {
  /** HTTP status. Default 500. */
  status?: number;
  /** `errors[0].title`, which is what `RestClient` puts in `SgApiError.message`. */
  message?: string;
  /** Parsed response body, for code that inspects `SgApiError.body`. */
  body?: unknown;
}

export interface MockClientOptions {
  /** Fixture seed. The same seed always produces the same site. Default 1. */
  seed?: number;
  /** Simulated round trip, in milliseconds, applied to every call. Default 0. */
  latencyMs?: number;
  /** Arm a failure for the very first call, for demoing an error state without extra wiring. */
  failNext?: MockFailure | null;
  /** How many rows of the scaled types to generate. Default 60 Versions. */
  counts?: { versions?: number };
}

/* -------------------------------------------------------------------------- */
/* rows                                                                       */
/* -------------------------------------------------------------------------- */

interface Row {
  type: string;
  id: number;
  /** Field values by programmatic name, including `id`. Entity links are `{type, id}` hashes. */
  values: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* field schemas                                                              */
/* -------------------------------------------------------------------------- */

interface FieldSpec {
  displayName: string;
  dataType: string;
  editable?: boolean;
  mandatory?: boolean;
  unique?: boolean;
  validTypes?: string[];
  validValues?: string[];
  displayValues?: Record<string, string>;
  defaultValue?: unknown;
  description?: string;
}

/**
 * Status vocabularies. `valid_values` is the site's whole vocabulary and is
 * byte-identical at every scope; only `hidden_values` varies per project
 * (009_status_lists). Version's list is the one the probed site answered.
 */
const VERSION_STATUSES = [
  'na', 'rev', 'vwd', 'apr', 'custom', 'fin', 'ip', 'clsd',
  'cmpt', 'cfrm', 'pndad', 'pndl', 'pndvs', 'part', 'pass', 'pndng',
];
/** Task's list, also verbatim from 009_status_lists: it overlaps Version on five codes only. */
const TASK_STATUSES = ['wtg', 'ip', 'fin', 'apr', 'dis', 'na', 'hld', 'rev', 'omt', 'ready'];
const SHOT_STATUSES = ['wtg', 'ip', 'rev', 'apr', 'fin', 'hld', 'omt'];
/** Sequence's list, verbatim from entity_types/Sequence. */
const SEQUENCE_STATUSES = ['wtg', 'ip', 'fin'];
/** entity_types/HumanUser: two codes, `act` the default, and `act` is a condition on impersonation. */
const USER_STATUSES = ['act', 'dis'];

/** `display_values` is per site, not per type; a missing key falls back to the raw code (009_status_lists). */
const STATUS_DISPLAY: Record<string, string> = {
  na: 'N/A', rev: 'Pending Review', vwd: 'Viewed', apr: 'Approved', custom: 'CustomIcon',
  fin: 'Final', ip: 'In Progress', clsd: 'Closed', cmpt: 'Complete', cfrm: 'Confirmed',
  pndad: 'Pending Art Director', pndl: 'Pending Lead', pndvs: 'Pending VFX Supervisor',
  part: 'partial', pass: 'pass', pndng: 'Pending', wtg: 'Waiting to Start', hld: 'On Hold',
  omt: 'Omitted', dis: 'Discarded', ready: 'Ready to Start', act: 'Active',
};

/** `bg_color` is comma-separated decimal RGB, never hex (010_status_icons). */
const STATUS_BG: Record<string, string> = {
  na: '150,150,150', wtg: '178,178,178', ready: '120,190,240', ip: '43,139,214',
  rev: '250,190,53', vwd: '154,113,190', apr: '25,118,27', fin: '80,143,66',
  cmpt: '25,118,27', cfrm: '52,152,219', clsd: '90,90,90', hld: '224,80,80',
  omt: '128,128,128', dis: '160,160,160', part: '200,150,50', pass: '100,180,100',
  pndad: '236,151,31', pndl: '236,151,31', pndvs: '236,151,31', pndng: '236,151,31',
  custom: '255,105,180', act: '25,118,27',
};

/** A 1x1 png, standing in for the one `display_type: image` icon the probed site had. */
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const ASSET_TYPES = ['Character', 'Environment', 'Prop', 'Vehicle', 'FX', 'Matte Painting'];
const SHOT_TYPES = ['VFX', '2D', 'Full CG', 'Trailer', 'Marketing', 'Look Dev'];
const VERSION_TYPES = ['Type A', 'Type B', 'Type C'];
/** Project's own status field is a plain `list` with no Status row behind it (entity_types/Project). */
const PROJECT_STATUSES = ['Active', 'Bidding', 'Complete', 'On Hold'];

const AUDIT: Record<string, FieldSpec> = {
  id: { displayName: 'Id', dataType: 'number', editable: false },
  cached_display_name: { displayName: 'Display Name', dataType: 'text' },
  created_at: { displayName: 'Date Created', dataType: 'date_time', editable: false },
  updated_at: { displayName: 'Date Updated', dataType: 'date_time', editable: false },
  created_by: { displayName: 'Created by', dataType: 'entity', editable: false, validTypes: ['HumanUser', 'ApiUser'] },
  updated_by: { displayName: 'Updated by', dataType: 'entity', editable: false, validTypes: ['HumanUser', 'ApiUser'] },
};

function statusSpec(validValues: string[], defaultValue: string): FieldSpec {
  return {
    displayName: 'Status',
    dataType: 'status_list',
    validValues,
    displayValues: Object.fromEntries(validValues.map((c) => [c, STATUS_DISPLAY[c] ?? c])),
    defaultValue,
  };
}

const SPECS: Record<string, Record<string, FieldSpec>> = {
  // Project is site-wide: it has no `project` field, so `project.Project.id` 400s on it.
  Project: {
    ...AUDIT,
    name: { displayName: 'Project Name', dataType: 'text', mandatory: true, unique: true },
    code: { displayName: 'Project Code', dataType: 'text', unique: true },
    tank_name: { displayName: 'Tank Name', dataType: 'text' },
    // Project's status field is `sg_status`, a `list`: no Status row, no icon, no bg_color.
    sg_status: { displayName: 'Status', dataType: 'list', validValues: PROJECT_STATUSES, defaultValue: 'Active' },
    sg_type: { displayName: 'Type', dataType: 'list', validValues: ['Feature', 'Episodic', 'Commercial', 'Short'] },
    sg_description: { displayName: 'Description', dataType: 'text' },
    sg_start_date: { displayName: 'Start Date', dataType: 'date' },
    sg_end_date: { displayName: 'End Date', dataType: 'date' },
    sg_frame_rate: { displayName: 'Frame Rate', dataType: 'float' },
    sg_progress: { displayName: 'Progress', dataType: 'percent' },
    archived: { displayName: 'Archived', dataType: 'checkbox' },
    is_demo: { displayName: 'Is Demo', dataType: 'checkbox', editable: false },
    is_template: { displayName: 'Is Template', dataType: 'checkbox', editable: false },
    image: { displayName: 'Thumbnail', dataType: 'image' },
    landing_page_url: { displayName: 'Landing Page URL', dataType: 'text', editable: false },
    users: { displayName: 'Users', dataType: 'multi_entity', validTypes: ['HumanUser'] },
  },
  Sequence: {
    ...AUDIT,
    code: { displayName: 'Sequence Name', dataType: 'text', mandatory: true },
    description: { displayName: 'Description', dataType: 'text' },
    sg_status_list: statusSpec(SEQUENCE_STATUSES, 'ip'),
    sg_timecode: { displayName: 'Timecode', dataType: 'timecode' },
    sg_cut_duration: { displayName: 'Cut Duration', dataType: 'number' },
    image: { displayName: 'Thumbnail', dataType: 'image' },
    project: { displayName: 'Project', dataType: 'entity', mandatory: true, validTypes: ['Project'] },
    shots: { displayName: 'Shots', dataType: 'multi_entity', validTypes: ['Shot'] },
  },
  Shot: {
    ...AUDIT,
    code: { displayName: 'Shot Code', dataType: 'text', mandatory: true },
    description: { displayName: 'Description', dataType: 'text' },
    sg_status_list: statusSpec(SHOT_STATUSES, 'wtg'),
    sg_shot_type: { displayName: 'Shot Type', dataType: 'list', validValues: SHOT_TYPES },
    sg_cut_in: { displayName: 'Cut In', dataType: 'number' },
    sg_cut_out: { displayName: 'Cut Out', dataType: 'number' },
    sg_cut_duration: { displayName: 'Cut Duration', dataType: 'number' },
    sg_working_duration: { displayName: 'Working Duration', dataType: 'duration' },
    sg_turnover_date: { displayName: 'Turnover Date', dataType: 'date' },
    sg_complexity: { displayName: 'Complexity', dataType: 'percent' },
    sg_lens: { displayName: 'Lens (mm)', dataType: 'float' },
    sg_omit: { displayName: 'Omitted', dataType: 'checkbox' },
    image: { displayName: 'Thumbnail', dataType: 'image' },
    sg_shot_notes_url: { displayName: 'Notes URL', dataType: 'url' },
    project: { displayName: 'Project', dataType: 'entity', mandatory: true, validTypes: ['Project'] },
    sg_sequence: { displayName: 'Sequence', dataType: 'entity', validTypes: ['Sequence'] },
    assets: { displayName: 'Assets', dataType: 'multi_entity', validTypes: ['Asset'] },
    tasks: { displayName: 'Tasks', dataType: 'multi_entity', validTypes: ['Task'] },
  },
  Asset: {
    ...AUDIT,
    code: { displayName: 'Asset Name', dataType: 'text', mandatory: true },
    description: { displayName: 'Description', dataType: 'text' },
    sg_status_list: statusSpec(SHOT_STATUSES, 'wtg'),
    sg_asset_type: { displayName: 'Asset Type', dataType: 'list', validValues: ASSET_TYPES },
    sg_build_days: { displayName: 'Build Days', dataType: 'number' },
    sg_complexity: { displayName: 'Complexity', dataType: 'percent' },
    sg_due_date: { displayName: 'Due Date', dataType: 'date' },
    sg_published: { displayName: 'Published', dataType: 'checkbox' },
    image: { displayName: 'Thumbnail', dataType: 'image' },
    project: { displayName: 'Project', dataType: 'entity', mandatory: true, validTypes: ['Project'] },
    shots: { displayName: 'Shots', dataType: 'multi_entity', validTypes: ['Shot'] },
    sequences: { displayName: 'Sequences', dataType: 'multi_entity', validTypes: ['Sequence'] },
    tasks: { displayName: 'Tasks', dataType: 'multi_entity', validTypes: ['Task'] },
  },
  Version: {
    ...AUDIT,
    code: { displayName: 'Version Name', dataType: 'text', mandatory: true },
    description: { displayName: 'Description', dataType: 'text' },
    // The field field_types/text was probed on, and null on 100 of 100 rows there. Half the
    // fixtures leave it null so a caller can exercise "negation includes nulls".
    sg_department: { displayName: 'Department', dataType: 'text' },
    sg_status_list: statusSpec(VERSION_STATUSES, 'rev'),
    sg_version_type: { displayName: 'Version Type', dataType: 'list', validValues: VERSION_TYPES, defaultValue: 'Type A' },
    sg_first_frame: { displayName: 'First Frame', dataType: 'number' },
    sg_last_frame: { displayName: 'Last Frame', dataType: 'number' },
    frame_count: { displayName: 'Frame Count', dataType: 'number' },
    sg_uploaded_movie_frame_rate: { displayName: 'Movie Frame Rate', dataType: 'float' },
    sg_uploaded_movie_transcoding_status: { displayName: 'Transcoding Status', dataType: 'number' },
    sg_path_to_frames: { displayName: 'Path to Frames', dataType: 'text' },
    sg_path_to_movie: { displayName: 'Path to Movie', dataType: 'text' },
    client_approved: { displayName: 'Client Approved', dataType: 'checkbox' },
    client_approved_at: { displayName: 'Client Approved at', dataType: 'date_time' },
    image: { displayName: 'Thumbnail', dataType: 'image' },
    sg_uploaded_movie: { displayName: 'Uploaded Movie', dataType: 'url' },
    project: { displayName: 'Project', dataType: 'entity', mandatory: true, validTypes: ['Project'] },
    // The probed site links 99% of Versions through `entity` to a Shot and 1% to an Asset (005_link_usage).
    entity: { displayName: 'Link', dataType: 'entity', validTypes: ['Shot', 'Asset', 'Sequence'] },
    sg_task: { displayName: 'Task', dataType: 'entity', validTypes: ['Task'] },
    user: { displayName: 'Artist', dataType: 'entity', validTypes: ['HumanUser', 'ApiUser'] },
    playlists: { displayName: 'Playlists', dataType: 'multi_entity', validTypes: ['Playlist'] },
  },
  Task: {
    ...AUDIT,
    // Task's identity field is `content`. It has no `code` and no `name`: both 400 in a filter.
    content: { displayName: 'Task Name', dataType: 'text', mandatory: true },
    sg_description: { displayName: 'Description', dataType: 'text' },
    sg_status_list: statusSpec(TASK_STATUSES, 'wtg'),
    start_date: { displayName: 'Start Date', dataType: 'date' },
    due_date: { displayName: 'Due Date', dataType: 'date' },
    // A duration is a bare integer of minutes; the working day is `hours_per_day` from /preferences.
    duration: { displayName: 'Duration', dataType: 'duration' },
    est_in_mins: { displayName: 'Bid', dataType: 'duration' },
    time_logs_sum: { displayName: 'Time Logged', dataType: 'duration', editable: false },
    time_percent_of_est: { displayName: 'Time Percent of Bid', dataType: 'percent', editable: false },
    // Task.color holds the token `pipeline_step`, not a colour: read `step.Step.color` (field_types/color).
    color: { displayName: 'Task Color', dataType: 'color' },
    milestone: { displayName: 'Milestone', dataType: 'checkbox' },
    project: { displayName: 'Project', dataType: 'entity', mandatory: true, validTypes: ['Project'] },
    entity: { displayName: 'Link', dataType: 'entity', validTypes: ['Shot', 'Asset', 'Sequence'] },
    step: { displayName: 'Pipeline Step', dataType: 'entity', validTypes: ['Step'] },
    task_assignees: { displayName: 'Assigned To', dataType: 'multi_entity', validTypes: ['Group', 'HumanUser'] },
    task_reviewers: { displayName: 'Reviewers', dataType: 'multi_entity', validTypes: ['Group', 'HumanUser'] },
    upstream_tasks: { displayName: 'Upstream Tasks', dataType: 'multi_entity', validTypes: ['Task'] },
  },
  HumanUser: {
    ...AUDIT,
    // `login` is the only unique field on the type, and it is what `sudo_as_login` matches.
    login: { displayName: 'Login', dataType: 'text', unique: true },
    name: { displayName: 'Name', dataType: 'text', mandatory: true },
    firstname: { displayName: 'First Name', dataType: 'text' },
    lastname: { displayName: 'Last Name', dataType: 'text' },
    email: { displayName: 'Email', dataType: 'text' },
    sg_status_list: statusSpec(USER_STATUSES, 'act'),
    // The HumanUser card does not enumerate `image`; the shape is field_types/image, a presigned URL string.
    image: { displayName: 'Thumbnail', dataType: 'image' },
    password_proxy: { displayName: 'Password', dataType: 'password', editable: false },
    can_impersonate_this_user: { displayName: 'Can Impersonate', dataType: 'checkbox', editable: false },
    sg_department_name: { displayName: 'Department Name', dataType: 'text' },
    projects: { displayName: 'Projects', dataType: 'multi_entity', validTypes: ['Project'] },
    groups: { displayName: 'Groups', dataType: 'multi_entity', validTypes: ['Group'] },
    permission_rule_set: { displayName: 'Permission Rule Set', dataType: 'entity', editable: false, validTypes: ['PermissionRuleSet'] },
  },
  // Lean schemas: enough for `search` and a picker, not a full transcription of the type.
  ApiUser: {
    ...AUDIT,
    firstname: { displayName: 'Script Name', dataType: 'text' },
    email: { displayName: 'Email', dataType: 'text' },
    description: { displayName: 'Description', dataType: 'text' },
    // 049_script_events: a script's writes reach the event log only while this is true, and it defaults to false.
    generate_event_log_entries: { displayName: 'Generate Events', dataType: 'checkbox' },
    projects: { displayName: 'Projects', dataType: 'multi_entity', validTypes: ['Project'] },
  },
  Step: {
    ...AUDIT,
    code: { displayName: 'Step Name', dataType: 'text', mandatory: true },
    short_name: { displayName: 'Short Name', dataType: 'text', mandatory: true },
    // `entity_type` is a bare schema name (`Shot`), never the URL slug, and is case-sensitive on filter.
    entity_type: { displayName: 'Entity Type', dataType: 'entity_type', editable: false },
    list_order: { displayName: 'Sort Order', dataType: 'number' },
    color: { displayName: 'Color', dataType: 'color' },
  },
  Status: {
    ...AUDIT,
    code: { displayName: 'Status Code', dataType: 'text', unique: true },
    name: { displayName: 'Status Name', dataType: 'text' },
    bg_color: { displayName: 'Background Colour', dataType: 'color' },
    icon: { displayName: 'Icon', dataType: 'entity', validTypes: ['Icon'] },
  },
  Icon: {
    ...AUDIT,
    name: { displayName: 'Icon Name', dataType: 'text' },
    display_type: { displayName: 'Display Type', dataType: 'list', validValues: ['image_map', 'image', 'html'] },
    icon_type: { displayName: 'Icon Type', dataType: 'list', validValues: ['permanent_status', 'custom_status'] },
    image_map_key: { displayName: 'Image Map Key', dataType: 'text' },
    url: { displayName: 'URL', dataType: 'text' },
    image_data: { displayName: 'Image Data', dataType: 'text' },
    html: { displayName: 'HTML', dataType: 'text' },
  },
};

const DISPLAY_NAMES: Record<string, string> = {
  Project: 'Project', Sequence: 'Sequence', Shot: 'Shot', Asset: 'Asset', Version: 'Version',
  Task: 'Task', HumanUser: 'Person', ApiUser: 'Script', Step: 'Pipeline Step',
  Status: 'Status', Icon: 'Icon',
};

/**
 * Which codes each project hides, per type. `hidden_values` is the only thing
 * `project_id` changes (009_status_lists), and it is not a subset of
 * `valid_values`: the probed site hid `blk` and `rdy`, neither of them valid.
 */
const HIDDEN_VALUES: Record<number, Record<string, string[]>> = {
  70: {
    'Version.sg_status_list': ['part', 'pass', 'pndad', 'pndl', 'pndvs', 'pndng'],
    'Task.sg_status_list': ['omt', 'dis'],
    'Shot.sg_status_list': ['omt'],
    'Asset.sg_status_list': ['omt'],
    'Sequence.sg_status_list': [],
    'Project.sg_status': [],
  },
  71: {
    'Version.sg_status_list': ['pndl', 'pndvs'],
    'Task.sg_status_list': ['dis', 'hld', 'blk'],
    'Shot.sg_status_list': ['hld', 'omt'],
    'Asset.sg_status_list': [],
    'Sequence.sg_status_list': [],
    'Project.sg_status': ['On Hold'],
  },
};

/* -------------------------------------------------------------------------- */
/* fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** mulberry32: a small, fast, seedable PRNG so a seed reproduces a whole site. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EPOCH = Date.UTC(2026, 0, 5);

function isoDate(dayOffset: number): string {
  return new Date(EPOCH + dayOffset * 86_400_000).toISOString().slice(0, 10);
}

/** `YYYY-MM-DDTHH:MM:SSZ`: second resolution, literal Z, never an offset (field_types/date_time). */
function isoDateTime(dayOffset: number, seconds = 0): string {
  return `${new Date(EPOCH + dayOffset * 86_400_000 + seconds * 1000).toISOString().slice(0, 19)}Z`;
}

function thumb(slug: string, w = 96, h = 54): string {
  return `https://picsum.photos/seed/${slug}/${w}/${h}`;
}

/** Illustrated portraits from DiceBear's CC0 "lorelei" set, one per login, so no real face appears. */
function portrait(login: string): string {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(login)}&backgroundType=gradientLinear&backgroundColor=d1d4f9,c0aede,ffdfbf,b6e3f4`;
}

function ref(row: Row): EntityRef {
  return { type: row.type, id: row.id };
}

interface Fixtures {
  rows: Map<string, Row[]>;
  /** Every row by `Type:id`, for resolving a link's display name and a dotted path. */
  index: Map<string, Row>;
}

const STEP_SEEDS = [
  { code: 'Layout', short_name: 'layout', entity_type: 'Shot', color: '110,180,200' },
  { code: 'Animation', short_name: 'ANM', entity_type: 'Shot', color: '253,94,99' },
  { code: 'Character FX', short_name: 'CFX', entity_type: 'Shot', color: '190,120,220' },
  { code: 'Lighting', short_name: 'LGT', entity_type: 'Shot', color: '240,190,90' },
  { code: 'FX', short_name: 'FX', entity_type: 'Shot', color: '90,200,160' },
  { code: 'Comp', short_name: 'CMP', entity_type: 'Shot', color: '70,140,230' },
  { code: 'Model', short_name: 'MDL', entity_type: 'Asset', color: '200,140,90' },
  { code: 'Rig', short_name: 'RIG', entity_type: 'Asset', color: '150,150,220' },
  { code: 'Texture', short_name: 'TXT', entity_type: 'Asset', color: '220,150,110' },
];

const USER_SEEDS = [
  { first: 'Ada', last: 'Lovelace', dept: 'Animation', status: 'act' },
  { first: 'Bo', last: 'Chen', dept: 'Lighting', status: 'dis' },
  { first: 'Cleo', last: 'Dias', dept: 'Comp', status: 'act' },
  { first: 'Dmitri', last: 'Ivanov', dept: 'FX', status: 'act' },
  { first: 'Eve', last: 'Kim', dept: 'Layout', status: 'dis' },
  { first: 'Farid', last: 'Nasser', dept: 'Modelling', status: 'act' },
  { first: 'Grace', last: 'Ono', dept: 'Rigging', status: 'act' },
  { first: 'Hiro', last: 'Tanaka', dept: 'Production', status: 'act' },
];

const ASSET_SEEDS = [
  { code: 'charAda', type: 'Character', project: 0 },
  { code: 'charBruno', type: 'Character', project: 0 },
  { code: 'propLantern', type: 'Prop', project: 0 },
  { code: 'propCrate', type: 'Prop', project: 0 },
  { code: 'envForest', type: 'Environment', project: 0 },
  { code: 'envStation', type: 'Environment', project: 0 },
  { code: 'vehRover', type: 'Vehicle', project: 0 },
  { code: 'charLuna', type: 'Character', project: 1 },
  { code: 'envHarbour', type: 'Environment', project: 1 },
  { code: 'fxDust', type: 'FX', project: 1 },
];

function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  // items is never empty in this file; the guard keeps noUncheckedIndexedAccess happy.
  return item ?? (items[0] as T);
}

function buildFixtures(seed: number, counts: { versions?: number } = {}): Fixtures {
  const rng = mulberry32(seed);
  const rows = new Map<string, Row[]>();
  const index = new Map<string, Row>();

  const add = (type: string, id: number, values: Record<string, unknown>): Row => {
    const row: Row = { type, id, values: { ...values, id } };
    const list = rows.get(type);
    if (list) list.push(row);
    else rows.set(type, [row]);
    index.set(`${type}:${id}`, row);
    return row;
  };

  /* people ---------------------------------------------------------------- */
  const users = USER_SEEDS.map((u, i) => {
    const login = `${u.first.toLowerCase()}.${u.last.toLowerCase()}`;
    const name = `${u.first} ${u.last}`;
    return add('HumanUser', 20 + i, {
      login,
      name,
      cached_display_name: name,
      firstname: u.first,
      lastname: u.last,
      email: `${login}@example.studio`,
      sg_status_list: u.status,
      image: portrait(login),
      password_proxy: '*******',
      can_impersonate_this_user: true,
      sg_department_name: u.dept,
      projects: [],
      groups: [],
      permission_rule_set: { type: 'PermissionRuleSet', id: 8 },
      created_at: isoDateTime(-200 + i),
      updated_at: isoDateTime(-10 + i),
      created_by: null,
      updated_by: null,
    });
  });
  const activeUsers = users.filter((u) => u.values['sg_status_list'] === 'act');

  const apiUsers = ['sg_widgets_demo', 'pipeline_bot'].map((n, i) =>
    add('ApiUser', 90 + i, {
      firstname: n,
      cached_display_name: n,
      email: `${n}@example.studio`,
      description: i === 0 ? 'Widget demos' : 'Nightly publishes',
      // Defaults to false on a real site, and nothing errors when it is off (049_script_events).
      generate_event_log_entries: i === 0,
      projects: [],
      created_at: isoDateTime(-300 + i),
      updated_at: isoDateTime(-300 + i),
      created_by: null,
      updated_by: null,
    }),
  );
  const bot = apiUsers[0] as Row;

  const steps = STEP_SEEDS.map((s, i) =>
    add('Step', 1 + i, {
      code: s.code,
      short_name: s.short_name,
      cached_display_name: null, // null on every Step on the probed site; display `code` instead.
      entity_type: s.entity_type,
      list_order: i + 1,
      color: s.color,
      created_at: isoDateTime(-400),
      updated_at: isoDateTime(-400),
      created_by: null,
      updated_by: null,
    }),
  );

  /* statuses and icons ----------------------------------------------------- */
  const allCodes = [...new Set([...VERSION_STATUSES, ...TASK_STATUSES, ...SHOT_STATUSES, ...SEQUENCE_STATUSES, ...USER_STATUSES])];
  allCodes.forEach((code, i) => {
    const iconId = 400 + i;
    // Three renderings, exactly as 010_status_icons groups them: 94 image_map, 1 image, 3 html.
    const iconValues: Record<string, unknown> =
      code === 'custom'
        ? { name: 'CustomIcon', display_type: 'image', icon_type: 'custom_status', image_map_key: null, url: TINY_PNG_DATA_URL, image_data: TINY_PNG_DATA_URL.split(',')[1] ?? '', html: null }
        : code === 'act'
          ? { name: 'ActiveBadge', display_type: 'html', icon_type: 'custom_status', image_map_key: null, url: '', image_data: null, html: 'Active' }
          : { name: `icon_${code}`, display_type: 'image_map', icon_type: 'permanent_status', image_map_key: `icon_${code}`, url: '', image_data: null, html: null };
    const icon = add('Icon', iconId, {
      ...iconValues,
      cached_display_name: iconValues['name'],
      created_at: isoDateTime(-500),
      updated_at: isoDateTime(-500),
      created_by: null,
      updated_by: null,
    });
    const name = STATUS_DISPLAY[code] ?? code;
    add('Status', 300 + i, {
      code,
      name,
      cached_display_name: name,
      bg_color: STATUS_BG[code] ?? '150,150,150',
      icon: ref(icon),
      created_at: isoDateTime(-500),
      updated_at: isoDateTime(-500),
      created_by: null,
      updated_by: null,
    });
  });

  /* projects --------------------------------------------------------------- */
  const projectSeeds = [
    { id: 70, name: 'Blue Moon Rising', code: 'bmr', status: 'Active', type: 'Feature' },
    { id: 71, name: 'Harbour Lights', code: 'hbl', status: 'Bidding', type: 'Episodic' },
    // A project whose Shots are grouped by a field no row of it fills, which the
    // navigation tree answers as an empty level (064_hierarchy_expand_buckets).
    { id: 72, name: 'Night Ferry', code: 'nfr', status: 'Active', type: 'Short' },
  ];
  const projects = projectSeeds.map((p, i) =>
    add('Project', p.id, {
      name: p.name,
      code: p.code,
      cached_display_name: p.name,
      tank_name: p.code,
      sg_status: p.status,
      sg_type: p.type,
      sg_description: `${p.name}, the ${p.type.toLowerCase()}.`,
      sg_start_date: isoDate(-120 + i * 30),
      sg_end_date: isoDate(240 + i * 30),
      sg_frame_rate: 24.0,
      sg_progress: 40 + i * 15,
      archived: false,
      is_demo: false,
      is_template: false,
      image: thumb(p.code, 128, 72),
      landing_page_url: `/detail/Project/${p.id}?legacy=true`,
      users: activeUsers.map(ref),
      created_at: isoDateTime(-150 + i),
      updated_at: isoDateTime(-5 + i),
      created_by: ref(bot),
      updated_by: ref(bot),
    }),
  );
  const p0 = projects[0] as Row;
  const p1 = projects[1] as Row;
  const p2 = projects[2] as Row;
  for (const u of users) u.values['projects'] = [ref(p0), ref(p1), ref(p2)];
  for (const a of apiUsers) a.values['projects'] = [ref(p0), ref(p1), ref(p2)];

  /* sequences -------------------------------------------------------------- */
  const seqSeeds = [
    { code: 'sh010', project: p0 }, { code: 'sh020', project: p0 },
    { code: 'sh030', project: p0 }, { code: 'sh040', project: p0 },
    { code: 'hb010', project: p1 }, { code: 'hb020', project: p1 },
  ];
  const sequences = seqSeeds.map((s, i) =>
    add('Sequence', 100 + i, {
      code: s.code,
      cached_display_name: s.code,
      description: `Sequence ${s.code}`,
      sg_status_list: pick(rng, SEQUENCE_STATUSES),
      sg_timecode: 3_600_000 + i * 60_000,
      sg_cut_duration: 200 + Math.floor(rng() * 400),
      image: thumb(s.code),
      project: ref(s.project),
      shots: [],
      created_at: isoDateTime(-140 + i),
      updated_at: isoDateTime(-20 + i),
      created_by: ref(bot),
      updated_by: ref(bot),
    }),
  );

  /* shots ------------------------------------------------------------------ */
  const shots: Row[] = [];
  const shotsPerSequence = [7, 6, 5, 4, 5, 3]; // 30 in total
  let shotId = 862;
  sequences.forEach((seq, si) => {
    const count = shotsPerSequence[si] ?? 5;
    for (let n = 0; n < count; n += 1) {
      const code = `${String(seq.values['code'])}_${String((n + 1) * 10).padStart(4, '0')}`;
      const cutIn = 1001;
      const duration = 40 + Math.floor(rng() * 160);
      const shot = add('Shot', shotId, {
        code,
        cached_display_name: code,
        description: `Shot ${code}`,
        sg_status_list: pick(rng, SHOT_STATUSES),
        sg_shot_type: pick(rng, SHOT_TYPES),
        sg_cut_in: cutIn,
        sg_cut_out: cutIn + duration,
        sg_cut_duration: duration,
        sg_working_duration: duration * 5,
        sg_turnover_date: isoDate(Math.floor(rng() * 120)),
        sg_complexity: Math.floor(rng() * 101),
        sg_lens: 24 + Math.round(rng() * 800) / 10,
        sg_omit: false,
        image: thumb(code),
        sg_shot_notes_url: null,
        project: seq.values['project'] as EntityRef,
        sg_sequence: ref(seq),
        assets: [],
        tasks: [],
        created_at: isoDateTime(-130 + shotId % 40),
        updated_at: isoDateTime(-15 + shotId % 10),
        created_by: ref(bot),
        updated_by: ref(bot),
      });
      shots.push(shot);
      (seq.values['shots'] as EntityRef[]).push(ref(shot));
      shotId += 1;
    }
  });

  /* shots with no sequence -------------------------------------------------- */
  // They stay out of `shots`, so they carry no task and no asset and the levels
  // above them hold nothing but the tree's ungrouped bucket.
  ['nf_0010', 'nf_0020', 'nf_0030'].forEach((code, i) => {
    const duration = 60 + i * 20;
    add('Shot', shotId + i, {
      code,
      cached_display_name: code,
      description: `Shot ${code}`,
      sg_status_list: pick(rng, SHOT_STATUSES),
      sg_shot_type: pick(rng, SHOT_TYPES),
      sg_cut_in: 1001,
      sg_cut_out: 1001 + duration,
      sg_cut_duration: duration,
      sg_working_duration: duration * 5,
      sg_turnover_date: isoDate(Math.floor(rng() * 120)),
      sg_complexity: Math.floor(rng() * 101),
      sg_lens: 24 + Math.round(rng() * 800) / 10,
      sg_omit: false,
      image: thumb(code),
      sg_shot_notes_url: null,
      project: ref(p2),
      sg_sequence: null,
      assets: [],
      tasks: [],
      created_at: isoDateTime(-100 + i),
      updated_at: isoDateTime(-10 + i),
      created_by: ref(bot),
      updated_by: ref(bot),
    });
  });

  /* assets ----------------------------------------------------------------- */
  const assets = ASSET_SEEDS.map((a, i) => {
    const project = a.project === 0 ? p0 : p1;
    return add('Asset', 1226 + i, {
      code: a.code,
      cached_display_name: a.code,
      description: `${a.type} asset ${a.code}`,
      sg_status_list: pick(rng, SHOT_STATUSES),
      sg_asset_type: a.type,
      sg_build_days: 1 + Math.floor(rng() * 20),
      sg_complexity: Math.floor(rng() * 101),
      sg_due_date: isoDate(Math.floor(rng() * 150)),
      sg_published: rng() > 0.5,
      image: thumb(a.code),
      project: ref(project),
      shots: [],
      sequences: [],
      tasks: [],
      created_at: isoDateTime(-135 + i),
      updated_at: isoDateTime(-12 + i),
      created_by: ref(bot),
      updated_by: ref(bot),
    });
  });
  // Link a few assets into shots of the same project, both ends.
  for (const shot of shots) {
    const projectId = (shot.values['project'] as EntityRef).id;
    const candidates = assets.filter((a) => (a.values['project'] as EntityRef).id === projectId);
    const chosen = candidates.filter(() => rng() < 0.3);
    shot.values['assets'] = chosen.map(ref);
    for (const asset of chosen) (asset.values['shots'] as EntityRef[]).push(ref(shot));
  }

  /* tasks ------------------------------------------------------------------ */
  const tasks: Row[] = [];
  let taskId = 5700;
  const taskTargets = [...shots, ...assets]; // 40 tasks, one per shot and asset
  for (const target of taskTargets) {
    const applicable = steps.filter((s) => s.values['entity_type'] === target.type);
    const step = pick(rng, applicable.length > 0 ? applicable : steps);
    const content = String(step.values['code']);
    const start = Math.floor(rng() * 90);
    const assignee = pick(rng, activeUsers);
    const task = add('Task', taskId, {
      content,
      cached_display_name: content,
      sg_description: `${content} on ${String(target.values['code'])}`,
      sg_status_list: pick(rng, TASK_STATUSES),
      start_date: isoDate(start),
      due_date: isoDate(start + 3 + Math.floor(rng() * 12)),
      // Minutes. 2400 is a Monday-to-Friday week at the probed site's hours_per_day of 8.
      duration: 480 * (1 + Math.floor(rng() * 5)),
      est_in_mins: 480 * (1 + Math.floor(rng() * 5)),
      time_logs_sum: 60 * Math.floor(rng() * 40),
      time_percent_of_est: Math.floor(rng() * 130),
      color: 'pipeline_step',
      milestone: false,
      project: target.values['project'] as EntityRef,
      entity: ref(target),
      step: ref(step),
      task_assignees: [ref(assignee)],
      task_reviewers: [],
      upstream_tasks: [],
      created_at: isoDateTime(-120 + (taskId % 50)),
      updated_at: isoDateTime(-8 + (taskId % 6)),
      created_by: ref(bot),
      updated_by: ref(bot),
    });
    (target.values['tasks'] as EntityRef[]).push(ref(task));
    tasks.push(task);
    taskId += 1;
  }

  /* versions --------------------------------------------------------------- */
  let versionId = 17055;
  const versionCount = counts.versions ?? 60;
  for (let i = 0; i < versionCount; i += 1) {
    // 005_link_usage: on the sample project every Version links through `entity`, almost all to a Shot.
    const target = i % 7 === 6 ? (assets[i % assets.length] as Row) : (shots[i % shots.length] as Row);
    const targetTasks = (target.values['tasks'] as EntityRef[]) ?? [];
    const task = targetTasks[0];
    const stepName = task ? String(index.get(`Task:${task.id}`)?.values['content'] ?? 'comp') : 'comp';
    const revision = 1 + Math.floor(i / shots.length) * 3 + (i % 3);
    const code = `${String(target.values['code'])}_${stepName.toLowerCase().replace(/\s+/g, '')}_v${String(revision).padStart(3, '0')}`;
    const first = 1001;
    const last = first + 40 + Math.floor(rng() * 120);
    add('Version', versionId, {
      code,
      cached_display_name: code,
      description: `Review submission for ${String(target.values['code'])}`,
      sg_department: i % 2 === 0 ? stepName : null,
      sg_status_list: pick(rng, VERSION_STATUSES),
      sg_version_type: pick(rng, VERSION_TYPES),
      sg_first_frame: first,
      sg_last_frame: last,
      frame_count: last - first + 1,
      sg_uploaded_movie_frame_rate: 24.0,
      sg_uploaded_movie_transcoding_status: 1,
      sg_path_to_frames: `/mnt/prod/${String((index.get(`Project:${(target.values['project'] as EntityRef).id}`) as Row).values['tank_name'])}/${String(target.values['code'])}/${code}.%04d.exr`,
      sg_path_to_movie: `/mnt/prod/mov/${code}.mov`,
      client_approved: rng() > 0.85,
      client_approved_at: null,
      image: thumb(code),
      sg_uploaded_movie: null,
      project: target.values['project'] as EntityRef,
      entity: ref(target),
      sg_task: task ?? null,
      user: ref(pick(rng, activeUsers)),
      playlists: [],
      created_at: isoDateTime(-100 + (i % 90), i),
      updated_at: isoDateTime(-3 + (i % 3), i),
      created_by: ref(bot),
      updated_by: ref(bot),
    });
    versionId += 1;
  }

  return { rows, index };
}

/* -------------------------------------------------------------------------- */
/* the client                                                                 */
/* -------------------------------------------------------------------------- */

export class MockClient implements SgClient {
  private readonly fixtures: Fixtures;
  private readonly latencyMs: number;
  private pendingFailure: MockFailure | null;

  constructor(options: MockClientOptions = {}) {
    this.fixtures = buildFixtures(options.seed ?? 1, options.counts ?? {});
    this.latencyMs = options.latencyMs ?? 0;
    this.pendingFailure = options.failNext ?? null;
  }

  /**
   * Make the next call reject with an `SgApiError`, for demoing an error state.
   * Pass `null` to disarm one that was already set.
   */
  failNext(failure: MockFailure | null = {}): void {
    this.pendingFailure = failure;
  }

  /** Rows of a type, in id order. Handy for writing assertions against the fixtures. */
  rowsOf(entityType: string): ReadonlyArray<Readonly<Record<string, unknown>>> {
    return (this.fixtures.rows.get(entityType) ?? []).map((r) => r.values);
  }

  private async gate(): Promise<void> {
    const failure = this.pendingFailure;
    this.pendingFailure = null;
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    if (failure) {
      const status = failure.status ?? 500;
      throw new SgApiError(status, failure.body ?? null, failure.message ?? `Flow PT API error ${status}`);
    }
  }

  private schemaOf(entityType: string): Record<string, FieldSpec> {
    const spec = SPECS[entityType];
    // 404 `Entity type 'X' does not exist.` is what GET /schema/<Type>/fields answers.
    if (!spec) throw new SgApiError(404, null, `Entity type '${entityType}' does not exist.`);
    return spec;
  }

  async entityTypes(): Promise<EntityTypeInfo[]> {
    await this.gate();
    return Object.keys(SPECS).map((name) => ({ name, displayName: DISPLAY_NAMES[name] ?? name }));
  }

  async fields(entityType: string, projectId?: number): Promise<Record<string, FieldSchema>> {
    await this.gate();
    const spec = this.schemaOf(entityType);
    const hidden = projectId === undefined ? undefined : (HIDDEN_VALUES[projectId] ?? {});
    const out: Record<string, FieldSchema> = {};
    for (const [name, s] of Object.entries(spec)) {
      const field: FieldSchema = {
        name,
        displayName: s.displayName,
        entityType,
        dataType: s.dataType,
        editable: s.editable ?? true,
        mandatory: s.mandatory ?? false,
        unique: s.unique ?? false,
      };
      if (s.validTypes) field.validTypes = s.validTypes;
      if (s.validValues) field.validValues = s.validValues;
      if (s.displayValues) field.displayValues = s.displayValues;
      if (s.defaultValue !== undefined) field.defaultValue = s.defaultValue;
      if (s.description) field.description = s.description;
      // `hidden_values` appears only when the schema is read with `project_id` (009_status_lists).
      if (hidden && (s.dataType === 'status_list' || s.dataType === 'list')) {
        field.hiddenValues = hidden[`${entityType}.${name}`] ?? [];
      }
      out[name] = field;
    }
    return out;
  }

  async fieldWithProject(entityType: string, field: string, projectId: number): Promise<FieldSchema> {
    const all = await this.fields(entityType, projectId);
    const one = all[field];
    // The 404 names the type and the field together, the only schema error that says which half is wrong.
    if (!one) throw new SgApiError(404, null, `Field '${entityType}.${field}' does not exist.`);
    return one;
  }

  async search(entityType: string, options: SearchOptions): Promise<SearchResult> {
    await this.gate();
    const spec = this.schemaOf(entityType);
    const all = this.fixtures.rows.get(entityType) ?? [];
    const matched = all.filter((row) => this.matchGroup(row, entityType, options.filters ?? null));
    const sorted = this.applySort(matched, entityType, options.sort);

    const size = options.page?.size ?? 50;
    const number = options.page?.number ?? 1;
    const start = (number - 1) * size;
    const page = sorted.slice(start, start + size);
    return {
      data: page.map((row) => this.project(row, spec, options.fields)),
      // Same rule as RestClient: `links.next` is emitted forever, so a full page is the only signal (006_pagination).
      hasMore: page.length === size,
    };
  }

  async textSearch(
    text: string,
    entityTypes: Record<string, TextSearchFilter>,
    page?: { size?: number; number?: number },
  ): Promise<TextSearchRow[]> {
    await this.gate();
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) throw new SgApiError(400, { page: null }, 'text must be filled');
    const size = page?.size ?? 25;
    // The cap is 25 and so is the default, and the message is off by one (053_text_search_matching).
    if (size > 25) throw new SgApiError(400, null, 'size must be less than 25');
    if (size < 1) throw new SgApiError(400, null, 'size must be greater than 0');
    const number = page?.number ?? 1;
    if (number < 1) throw new SgApiError(400, null, 'number must be greater than 0');

    const needles = words.map((w) => w.toLowerCase());
    const hits: Array<TextSearchRow & { sortName: string }> = [];
    for (const [type, filter] of Object.entries(entityTypes)) {
      // The map's value is a filter array, `[]` for none, and the array form is `and` only.
      const group: WireGroup = { logical_operator: 'and', conditions: toFilterArray(filter) };
      for (const row of this.fixtures.rows.get(type) ?? []) {
        if (!this.matchGroup(row, type, group)) continue;
        const name = displayNameOf(row.values, `#${row.id}`);
        // A row also matches on the name of the row it links to, the pair under `attributes.links`.
        const links = this.linkedPair(row);
        const haystack = `${name} ${links[1]}`.toLowerCase();
        if (!needles.every((w) => haystack.includes(w))) continue;
        hits.push({
          type,
          id: row.id,
          name,
          links,
          status: (row.values['sg_status_list'] ?? row.values['sg_status'] ?? null) as string | null,
          sortName: name,
        });
      }
    }
    // Rows come back shortest name first, across types, not by id and not grouped by type.
    hits.sort((a, b) => a.sortName.length - b.sortName.length || (a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : a.id - b.id));
    return hits.slice((number - 1) * size, (number - 1) * size + size).map(({ sortName: _sortName, ...row }) => row);
  }

  async update(entityType: string, id: number, patch: Record<string, unknown>): Promise<EntityRow> {
    await this.gate();
    const spec = this.schemaOf(entityType);
    const row = this.fixtures.index.get(`${entityType}:${id}`);
    // The 404 names the type and the id (put_entity_type_id).
    if (!row) throw new SgApiError(404, null, `Entity of type [${entityType}] with id=${id} does not exist.`);
    for (const [name, value] of Object.entries(patch)) {
      const field = spec[name];
      // `API create() Reply.project doesn't exist.` is the create spelling of this 400
      // (entity_types/Reply); a write to a read-only field is `is read only.` (entity_types/Sequence).
      if (!field) throw new SgApiError(400, null, `API update() ${entityType}.${name} doesn't exist.`);
      if (field.editable === false) throw new SgApiError(400, null, `API update() ${entityType}.${name} is read only.`);
      // Writing "" to a text field stores null: the two are one value (field_types/text).
      row.values[name] = field.dataType === 'text' && value === '' ? null : value;
    }
    if (Object.keys(patch).length > 0) row.values['updated_at'] = isoDateTime(0);
    // A PUT answers the whole record, changed fields and untouched ones alike (024_read_after_write).
    return this.project(row, spec);
  }

  /**
   * Counts without paging rows.
   *
   * `count` and the numeric aggregates are modelled; the rest of the vocabulary the
   * endpoint prints is not. A grouping returns one group per distinct value with the
   * empties under a `''` group, `group_value` is what the grouping was computed on and
   * `group_name` the server's render of it, and one type per field per call wins
   * (020_summarize).
   */
  async summarize(entityType: string, options: SummarizeOptions = {}): Promise<SummarizeResult> {
    await this.gate();
    this.schemaOf(entityType);
    const all = this.fixtures.rows.get(entityType) ?? [];
    const matched = all.filter((row) => this.matchGroup(row, entityType, options.filters ?? null));
    const fields = options.summaryFields ?? [{ field: 'id' as string, type: 'count' as const }];

    const summarize = (rows: Row[]): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const f of fields) {
        const values = rows.map((r) => this.walk(r, f.field, false)[0] ?? null).filter((v) => v !== null);
        const numbers = values.map(Number).filter((n) => !Number.isNaN(n));
        switch (f.type) {
          case 'count':
          case 'record_count':
            out[f.field] = f.field === 'id' || f.type === 'record_count' ? rows.length : values.length;
            break;
          case 'sum':
            out[f.field] = numbers.reduce((a, b) => a + b, 0);
            break;
          case 'maximum':
            out[f.field] = numbers.length > 0 ? Math.max(...numbers) : 0;
            break;
          case 'minimum':
            out[f.field] = numbers.length > 0 ? Math.min(...numbers) : 0;
            break;
          case 'average':
            out[f.field] = numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
            break;
          default:
            // An unmodelled type is left out, the way an unsummarizable field answers 200
            // with the key absent (020_summarize).
            break;
        }
      }
      return out;
    };

    const grouping = options.grouping?.[0];
    if (!grouping) return { summaries: summarize(matched), groups: [] };

    const buckets = new Map<string, { value: unknown; rows: Row[] }>();
    for (const row of matched) {
      const value = this.walk(row, grouping.field, false)[0] ?? null;
      const key = value === null || value === undefined ? '' : JSON.stringify(value);
      const bucket = buckets.get(key);
      if (bucket) bucket.rows.push(row);
      else buckets.set(key, { value, rows: [row] });
    }
    const groups: SummaryGroup[] = [...buckets.entries()].map(([, bucket]) => ({
      groupName: bucket.value === null ? '' : groupLabel(bucket.value),
      groupValue: bucket.value,
      summaries: summarize(bucket.rows),
    }));
    groups.sort((a, b) => (a.groupName < b.groupName ? -1 : a.groupName > b.groupName ? 1 : 0));
    if (grouping.direction === 'desc') groups.reverse();
    return { summaries: summarize(matched), groups };
  }

  /**
   * One level of the navigation tree.
   *
   * The shape is post_hierarchy_expand's: a node with `label`, `ref`, `path` and one
   * level of `children`. Which levels a project has is the site's own navigation
   * configuration and not a fixed hierarchy - the probed site's Shot path runs through
   * the field name `sg_sequence` (post_hierarchy_search) - so this fixture offers the
   * two branches that configuration draws for a stock project: Shots under their
   * Sequence, and Assets flat.
   */
  async hierarchyExpand(path: string): Promise<HierarchyNode> {
    await this.gate();
    const parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'Project' || parts.length < 2) {
      // Code 107 appears on this endpoint and nowhere else: a lookup that found the
      // wrong number of rows, not a malformed request (post_hierarchy_expand).
      throw new SgApiError(400, null, `Unexpected result looking for project: ${parts[1] ?? path}: 0 found.`);
    }
    const projectId = Number(parts[1]);
    const project = this.fixtures.index.get(`Project:${projectId}`);
    if (!project) throw new SgApiError(400, null, `Unexpected result looking for project: ${String(parts[1])}: 0 found.`);
    const rest = parts.slice(2);
    const above = parts.slice(0, -1).join('/');
    const parentPath = above === 'Project' ? '/' : `/${above}`;

    const node = (
      label: string,
      ref: HierarchyNode['ref'],
      own: string,
      children: HierarchyNode[],
      hasChildren?: boolean,
    ): HierarchyNode => ({
      label,
      ref,
      path: own,
      parentPath: own === path ? parentPath : null,
      hasChildren: hasChildren ?? children.length > 0,
      children,
    });
    const tasksOf = (row: Row): Row[] =>
      ((row.values['tasks'] as EntityRef[] | undefined) ?? [])
        .map((t) => this.fixtures.index.get(`Task:${t.id}`))
        .filter((t): t is Row => t !== undefined);
    // A Shot or an Asset carries its Tasks, so it is a level rather than a leaf.
    const leaf = (row: Row, own: string): HierarchyNode =>
      node(
        displayNameOf(row.values, `#${row.id}`),
        { kind: 'entity', value: { type: row.type, id: row.id } },
        own,
        [],
        tasksOf(row).length > 0,
      );
    const rowsOf = (type: string): Row[] =>
      (this.fixtures.rows.get(type) ?? []).filter((r) => (r.values['project'] as EntityRef | null)?.id === projectId);

    if (rest.length === 0) {
      return node(String(project.values['name']), { kind: 'entity', value: { type: 'Project', id: projectId } }, path, [
        node('Assets', { kind: 'entity_type', value: 'Asset' }, `${path}/Asset`, [], rowsOf('Asset').length > 0),
        node('Shots', { kind: 'entity_type', value: 'Shot' }, `${path}/Shot`, [], rowsOf('Shot').length > 0),
      ]);
    }
    if (rest.length === 1 && rest[0] === 'Asset') {
      return node(
        'Assets',
        { kind: 'entity_type', value: 'Asset' },
        path,
        rowsOf('Asset').map((r) => leaf(r, `${path}/id/${r.id}`)),
      );
    }
    /** A child standing for a level with nothing in it. It carries no path of its own. */
    const noRows = (label: string): HierarchyNode => node(label, { kind: 'empty', value: null }, path, [], false);
    const looseShots = (): Row[] => rowsOf('Shot').filter((r) => r.values['sg_sequence'] === null);

    if (rest.length === 1 && rest[0] === 'Shot') {
      const groups = rowsOf('Sequence').map((seq) =>
        node(
          String(seq.values['code']),
          { kind: 'entity', value: { type: 'Sequence', id: seq.id } },
          `${path}/sg_sequence/Sequence/${seq.id}`,
          [],
          (seq.values['shots'] as EntityRef[]).length > 0,
        ),
      );
      // A grouping field with no rows hides every row under it: the level answers one
      // `empty` child and no bucket, although the `__none__` path under it answers them
      // all. The site emits the bucket once after every group and the client dedupes the
      // repeats; this fixture emits it once, and only where it holds rows
      // (064_hierarchy_expand_buckets).
      if (groups.length === 0) return node('Shots', { kind: 'entity_type', value: 'Shot' }, path, [noRows('No Shots')]);
      const loose = looseShots();
      if (loose.length > 0) {
        groups.push(
          node('Shots with no Sequence', { kind: 'entity_type', value: 'Shot' }, `${path}/sg_sequence/Sequence/__none__`, [], true),
        );
      }
      return node('Shots', { kind: 'entity_type', value: 'Shot' }, path, groups);
    }
    // The bucket at both its spellings: `_expand` writes `<field>/<GroupType>/__none__`
    // and `_search` writes `<field>/__none__` (064_hierarchy_expand_buckets).
    if (rest[0] === 'Shot' && rest[1] === 'sg_sequence' && rest[rest.length - 1] === '__none__') {
      const loose = looseShots();
      return node(
        'Shots with no Sequence',
        { kind: 'entity_type', value: 'Shot' },
        path,
        loose.length > 0 ? loose.map((r) => leaf(r, `${path}/id/${r.id}`)) : [noRows('No Shots')],
      );
    }
    // The 400 names the grouping field the level takes, and it is the only way to learn it
    // (post_hierarchy_expand).
    if (rest[0] === 'Shot' && rest.length > 1 && rest[1] !== 'sg_sequence' && rest[1] !== 'id') {
      throw new SgApiError(400, null, `Unexpected field name in path: ${String(rest[1])} (expecting sg_sequence)`);
    }
    if (rest.length === 4 && rest[0] === 'Shot' && rest[1] === 'sg_sequence' && rest[2] === 'Sequence') {
      const seq = this.fixtures.index.get(`Sequence:${Number(rest[3])}`);
      if (!seq) throw new SgApiError(400, null, `Unexpected result looking for project: ${String(rest[3])}: 0 found.`);
      const shots = (seq.values['shots'] as EntityRef[])
        .map((r) => this.fixtures.index.get(`Shot:${r.id}`))
        .filter((r): r is Row => r !== undefined);
      return node(
        String(seq.values['code']),
        { kind: 'entity', value: { type: 'Sequence', id: seq.id } },
        path,
        shots.map((r) => leaf(r, `${path}/id/${r.id}`)),
      );
    }
    // A Shot or an Asset, which holds a Tasks folder, and the folder itself.
    const owner = rest[rest.length - 2] === 'id' ? this.rowAtPath(rest) : null;
    if (owner) {
      const tasks = tasksOf(owner);
      return node(
        displayNameOf(owner.values, `#${owner.id}`),
        { kind: 'entity', value: { type: owner.type, id: owner.id } },
        path,
        tasks.length > 0 ? [node('Tasks', { kind: 'entity_type', value: 'Task' }, `${path}/Task`, [], true)] : [],
      );
    }
    if (rest[rest.length - 1] === 'Task') {
      const holder = this.rowAtPath(rest.slice(0, -1));
      const tasks = holder ? tasksOf(holder) : [];
      return node(
        'Tasks',
        { kind: 'entity_type', value: 'Task' },
        path,
        tasks.map((t) => leaf(t, `${path}/id/${t.id}`)),
      );
    }
    // A path this fixture does not model: a node with nothing under it.
    return node(path.split('/').pop() ?? '', { kind: 'empty', value: null }, path, [], false);
  }

  /**
   * Where a row sits in the tree. The endpoint takes an entity and answers its
   * breadcrumb; it does not match words (post_hierarchy_search).
   */
  async hierarchySearch(rootPath: string, entity: EntityRef): Promise<HierarchyPath[]> {
    await this.gate();
    const incremental = this.pathTo(entity);
    const self = incremental[incremental.length - 1];
    if (self === undefined || !self.startsWith(rootPath)) return [];
    const labels = incremental.slice(1, -1).map((p) => this.labelAtPath(p));
    const row = this.fixtures.index.get(`${entity.type}:${entity.id}`);
    return [
      {
        label: row ? displayNameOf(row.values, `#${entity.id}`) : `${entity.type} #${entity.id}`,
        // The project is not in `path_label`, and the row itself is not either.
        pathLabel: labels.join(' > '),
        incrementalPath: incremental,
        ref: { type: entity.type, id: entity.id },
        projectId: row ? ((row.values['project'] as EntityRef | undefined)?.id ?? row.id) : null,
      },
    ];
  }

  /** What a level of the tree is called, without opening it. */
  private labelAtPath(path: string): string {
    const rest = path.split('/').filter(Boolean).slice(2);
    const last = rest[rest.length - 1];
    if (last === 'Asset') return 'Assets';
    if (last === 'Shot') return 'Shots';
    if (last === 'Task') return 'Tasks';
    if (last === '__none__') return 'Shots with no Sequence';
    if (rest[rest.length - 2] === 'Sequence') {
      const sequence = this.fixtures.index.get(`Sequence:${Number(last)}`);
      return sequence ? displayNameOf(sequence.values, `#${sequence.id}`) : '';
    }
    const row = this.rowAtPath(rest);
    return row ? displayNameOf(row.values, `#${row.id}`) : '';
  }

  /** The row a `.../id/<n>` path segment names, from the type the path last named. */
  private rowAtPath(rest: string[]): Row | null {
    const id = Number(rest[rest.length - 1]);
    if (!Number.isInteger(id)) return null;
    const type = rest.includes('Task') ? 'Task' : rest[0] === 'Asset' ? 'Asset' : 'Shot';
    return this.fixtures.index.get(`${type}:${id}`) ?? null;
  }

  /** The breadcrumb to a row, root first, the row itself last. Empty when it is not in the tree. */
  private pathTo(entity: EntityRef): string[] {
    const row = this.fixtures.index.get(`${entity.type}:${entity.id}`);
    if (!row) return [];
    if (entity.type === 'Project') return [`/Project/${entity.id}`];
    const projectId = (row.values['project'] as EntityRef | undefined)?.id;
    if (projectId === undefined) return [];
    const root = `/Project/${projectId}`;
    switch (entity.type) {
      case 'Sequence':
        return [root, `${root}/Shot`, `${root}/Shot/sg_sequence/Sequence/${entity.id}`];
      case 'Asset':
        return [root, `${root}/Asset`, `${root}/Asset/id/${entity.id}`];
      case 'Shot': {
        const sequence = row.values['sg_sequence'] as EntityRef | null;
        // `_search` spells the ungrouped bucket without the group type
        // (064_hierarchy_expand_buckets).
        const above = sequence
          ? this.pathTo({ type: 'Sequence', id: sequence.id })
          : [root, `${root}/Shot`, `${root}/Shot/sg_sequence/__none__`];
        if (above.length === 0) return [];
        return [...above, `${above[above.length - 1]}/id/${entity.id}`];
      }
      case 'Task': {
        const owner = row.values['entity'] as EntityRef | null;
        if (!owner) return [];
        const above = this.pathTo(owner);
        if (above.length === 0) return [];
        const ownerPath = above[above.length - 1] as string;
        return [...above, `${ownerPath}/Task`, `${ownerPath}/Task/id/${entity.id}`];
      }
      default:
        return [];
    }
  }

  async statuses(): Promise<StatusRecord[]> {
    await this.gate();
    return (this.fixtures.rows.get('Status') ?? []).map((row) => {
      const iconRef = row.values['icon'] as EntityRef | null;
      const icon = iconRef ? this.fixtures.index.get(`Icon:${iconRef.id}`) : undefined;
      return {
        id: row.id,
        code: String(row.values['code'] ?? ''),
        name: String(row.values['name'] ?? ''),
        bgColor: (row.values['bg_color'] as string | null) ?? null,
        icon: icon ? toStatusIcon(icon.values) : null,
      };
    });
  }

  /* ---------------------------------------------------------------------- */
  /* projection                                                             */
  /* ---------------------------------------------------------------------- */

  private displayNameOfRef(entityRef: EntityRef): string | undefined {
    const target = this.fixtures.index.get(`${entityRef.type}:${entityRef.id}`);
    if (!target) return undefined;
    // The `name` in an entity dict is the target's `cached_display_name` (060_entity_dict_name).
    return displayNameOf(target.values, `#${entityRef.id}`);
  }

  private decorate(value: unknown): EntityRef | EntityRef[] | null {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.map((v) => this.decorate(v) as EntityRef);
    const entityRef = value as EntityRef;
    const name = this.displayNameOfRef(entityRef);
    return name === undefined ? { type: entityRef.type, id: entityRef.id } : { type: entityRef.type, id: entityRef.id, name };
  }

  private project(row: Row, spec: Record<string, FieldSpec>, fields?: string[]): EntityRow {
    const names = fields ?? Object.keys(spec);
    const attributes: Record<string, unknown> = {};
    // `relationships` is `{}` rather than absent when no entity field was asked for.
    const relationships: Record<string, { data: EntityRef | EntityRef[] | null }> = {};
    for (const name of names) {
      if (name.includes('.')) {
        // A dotted path comes back flat under its literal key in attributes (003_query); a middle
        // segment outside the field's valid_types drops the key at 200 (059_dotted_path_type_check),
        // and a path through a multi_entity field reads back nothing at all (016_dotted_multi_entity).
        const resolved = this.resolveProjection(row, spec, name);
        if (resolved.present) attributes[name] = resolved.value;
        continue;
      }
      const field = spec[name];
      // An unknown name in `fields` is dropped at HTTP 200; only a filter 400s (003_query).
      if (!field) continue;
      if (isLinkType(field.dataType)) relationships[name] = { data: this.decorate(row.values[name]) };
      else attributes[name] = row.values[name] ?? null;
    }
    return { type: row.type, id: row.id, attributes, relationships };
  }

  private resolveProjection(row: Row, spec: Record<string, FieldSpec>, path: string): { present: boolean; value: unknown } {
    const segments = path.split('.');
    const head = segments[0] as string;
    const field = spec[head];
    if (!field || !isLinkType(field.dataType)) return { present: false, value: null };
    if (field.dataType === 'multi_entity') return { present: false, value: null };
    const targetType = segments[1];
    if (!targetType || (field.validTypes && !field.validTypes.includes(targetType))) return { present: false, value: null };
    const values = this.walk(row, path, false);
    return { present: true, value: values.length > 0 ? (values[0] ?? null) : null };
  }

  /* ---------------------------------------------------------------------- */
  /* paths                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Resolve a plain or dotted path to the values it reaches. `strict` makes an
   * unknown field or an unknown middle type throw the 400 the API answers in a
   * filter; the projection side wants a silent miss instead.
   */
  private walk(row: Row, path: string, strict: boolean): unknown[] {
    const segments = path.split('.');
    let current: Row[] = [row];
    let index = 0;
    while (segments.length - index > 1) {
      const fieldName = segments[index] as string;
      const targetType = segments[index + 1] as string;
      const next: Row[] = [];
      for (const node of current) {
        const spec = SPECS[node.type];
        const field = spec?.[fieldName];
        if (!field || !isLinkType(field.dataType)) {
          if (strict) throw new SgApiError(400, null, `API read() ${node.type}.${fieldName} doesn't exist.`);
          return [];
        }
        // The middle segment is checked against the schema alone in a filter (059_dotted_path_type_check).
        if (strict && !SPECS[targetType]) throw new SgApiError(400, null, `API read() ${targetType} is not a valid entity type.`);
        const raw = node.values[fieldName];
        const refs = raw === null || raw === undefined ? [] : Array.isArray(raw) ? (raw as EntityRef[]) : [raw as EntityRef];
        for (const entityRef of refs) {
          if (entityRef.type !== targetType) continue;
          const target = this.fixtures.index.get(`${entityRef.type}:${entityRef.id}`);
          if (target) next.push(target);
        }
      }
      current = next;
      index += 2;
    }
    const leaf = segments[index] as string;
    const out: unknown[] = [];
    for (const node of current) {
      const spec = SPECS[node.type];
      const field = spec?.[leaf];
      if (!field) {
        if (strict) throw new SgApiError(400, null, `API read() ${node.type}.${leaf} doesn't exist.`);
        continue;
      }
      out.push(node.values[leaf] ?? null);
    }
    return out;
  }

  /** The data type a filter path lands on, for choosing the comparison and validating the operator. */
  private dataTypeAt(entityType: string, path: string): string {
    const segments = path.split('.');
    let type = entityType;
    let index = 0;
    while (segments.length - index > 1) {
      const fieldName = segments[index] as string;
      const field = SPECS[type]?.[fieldName];
      if (!field) throw new SgApiError(400, null, `API read() ${type}.${fieldName} doesn't exist.`);
      type = segments[index + 1] as string;
      if (!SPECS[type]) throw new SgApiError(400, null, `API read() ${type} is not a valid entity type.`);
      index += 2;
    }
    const leaf = segments[index] as string;
    const field = SPECS[type]?.[leaf];
    if (!field) throw new SgApiError(400, null, `API read() ${type}.${leaf} doesn't exist.`);
    return field.dataType;
  }

  private linkedPair(row: Row): [string, string] {
    // `attributes.links` is the linked row's type and name, `["", ""]` when it links to nothing.
    for (const fieldName of ['entity', 'sg_sequence', 'project']) {
      const value = row.values[fieldName];
      if (value && !Array.isArray(value)) {
        const entityRef = value as EntityRef;
        const name = this.displayNameOfRef(entityRef);
        if (name !== undefined) return [entityRef.type, name];
      }
    }
    return ['', ''];
  }

  /* ---------------------------------------------------------------------- */
  /* filters                                                                */
  /* ---------------------------------------------------------------------- */

  private matchGroup(row: Row, entityType: string, group: WireGroup | null | undefined): boolean {
    if (!group) return true;
    const results = group.conditions.map((c) =>
      Array.isArray(c) ? this.matchCondition(row, entityType, c) : this.matchGroup(row, entityType, c),
    );
    // `"conditions": []` is 200 and matches every row: an empty group is no filter, not a no-match.
    if (results.length === 0) return true;
    return group.logical_operator === 'or' ? results.some(Boolean) : results.every(Boolean);
  }

  private matchCondition(row: Row, entityType: string, [path, operator, expected]: WireCondition): boolean {
    const dataType = this.dataTypeAt(entityType, path);
    if (!isFilterable(dataType)) {
      throw new SgApiError(400, null, `API read() ${entityType}.${path}'s '${dataType}' data type cannot be used in a filter.`);
    }
    if (!operatorsFor(dataType).includes(operator)) {
      throw new SgApiError(
        400,
        null,
        `API read() ${entityType}.${path}'s '${dataType}' data type doesn't support '${operator}' 'relation'`,
      );
    }
    const raw = this.walk(row, path, true);
    // `name_is`, `name_contains` and `name_not_contains` read the target's cached_display_name,
    // which a stored `{type, id}` link does not carry, so decorate before comparing.
    const values = operator.startsWith('name_') ? raw.map((v) => this.decorate(v)) : raw;
    // A dotted path that reaches several rows matches if any of them does.
    if (values.length > 1) return values.some((v) => evaluate(dataType, operator, v ?? null, expected));
    return evaluate(dataType, operator, values.length === 0 ? null : (values[0] ?? null), expected);
  }

  /* ---------------------------------------------------------------------- */
  /* sort                                                                   */
  /* ---------------------------------------------------------------------- */

  private applySort(rows: Row[], entityType: string, sort?: string): Row[] {
    // With no sort the order is id ascending, and id ascending is the implicit tiebreak (026_result_order).
    const out = [...rows].sort((a, b) => a.id - b.id);
    if (!sort) return out;
    const keys = sort
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .map((k) => (k.startsWith('-') ? { field: k.slice(1), descending: true } : { field: k, descending: false }))
      // A sort on a field that does not exist, or one that cannot be sorted, is a silent 200 no-op.
      .filter((k) => Boolean(SPECS[entityType]?.[k.field]) || k.field.includes('.'));
    if (keys.length === 0) return out;
    return out.sort((a, b) => {
      for (const key of keys) {
        const av = this.walk(a, key.field, false)[0] ?? null;
        const bv = this.walk(b, key.field, false)[0] ?? null;
        const c = sortCompare(av, bv);
        if (c !== 0) return key.descending ? -c : c;
      }
      return a.id - b.id;
    });
  }
}

/* -------------------------------------------------------------------------- */
/* operator evaluation                                                        */
/* -------------------------------------------------------------------------- */

function isNullish(v: unknown): boolean {
  // A text field has no empty string: writing "" stores null, so the two are one value (field_types/text).
  return v === null || v === undefined || v === '';
}

function refsOf(value: unknown): EntityRef[] {
  if (value === null || value === undefined) return [];
  return (Array.isArray(value) ? value : [value]) as EntityRef[];
}

function sameScalar(dataType: string, actual: unknown, expected: unknown): boolean {
  if (isNullish(expected)) return isNullish(actual);
  if (isNullish(actual)) return false;
  if (isLinkType(dataType)) {
    const wanted = expected as EntityRef;
    if (typeof wanted !== 'object' || wanted === null) return false;
    return refsOf(actual).some((r) => r.type === wanted.type && r.id === wanted.id);
  }
  if (isNumericType(dataType)) {
    // `is '1001'` matches the integer 1001: the API coerces a numeric string (field_types/number).
    const a = Number(actual);
    const b = Number(expected);
    return !Number.isNaN(a) && !Number.isNaN(b) && a === b;
  }
  if (typeof actual === 'string' && typeof expected === 'string') {
    // text, list and status_list all match case-insensitively, where a write is case-sensitive.
    return actual.toLowerCase() === expected.toLowerCase();
  }
  return actual === expected;
}

function substring(actual: unknown, expected: unknown, mode: 'contains' | 'starts' | 'ends'): boolean {
  if (isNullish(actual) || expected === null || expected === undefined) return false;
  const a = String(actual).toLowerCase();
  const b = String(expected).toLowerCase();
  return mode === 'contains' ? a.includes(b) : mode === 'starts' ? a.startsWith(b) : a.endsWith(b);
}

/** Order two filter values. Returns null when either is unset, which is what excludes null rows. */
function compare(a: unknown, b: unknown): number | null {
  if (isNullish(a) || isNullish(b)) return null;
  if (typeof a === 'number' || typeof b === 'number') {
    const x = Number(a);
    const y = Number(b);
    return Number.isNaN(x) || Number.isNaN(y) ? null : x - y;
  }
  // ISO dates and date-times order lexicographically.
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Sort order, with nulls last in both directions (entity_types/Step, on `list_order`). */
function sortCompare(a: unknown, b: unknown): number {
  const aNull = isNullish(a);
  const bNull = isNullish(b);
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return compare(a, b) ?? 0;
}

function namesOf(actual: unknown): string[] {
  return refsOf(actual)
    .map((r) => (typeof r.name === 'string' ? r.name : ''))
    .filter(Boolean);
}

function evaluate(dataType: string, operator: Operator, actual: unknown, expected: unknown): boolean {
  // Every negating operator also matches rows where the field is null: `is_not X` is not the
  // complement of `is X` on this API (field_types/date, field_types/number, field_types/entity).
  if (NEGATING_OPERATORS.has(operator) && isNullish(actual)) return true;

  switch (operator) {
    case 'is':
      return sameScalar(dataType, actual, expected);
    case 'is_not':
      return !sameScalar(dataType, actual, expected);
    case 'in':
      return asList(expected).some((e) => sameScalar(dataType, actual, e));
    case 'not_in':
      return !asList(expected).some((e) => sameScalar(dataType, actual, e));
    case 'contains':
      return substring(actual, expected, 'contains');
    case 'not_contains':
      return !substring(actual, expected, 'contains');
    case 'starts_with':
      return substring(actual, expected, 'starts');
    case 'ends_with':
      return substring(actual, expected, 'ends');
    case 'greater_than': {
      const c = compare(actual, expected);
      return c !== null && c > 0;
    }
    case 'less_than': {
      const c = compare(actual, expected);
      return c !== null && c < 0;
    }
    case 'between': {
      const [lo, hi] = asList(expected);
      // Inclusive at both ends and order-insensitive; a null bound matches nothing (field_types/date).
      const a = compare(actual, lo);
      const b = compare(actual, hi);
      if (a === null || b === null) return false;
      return (a >= 0 && b <= 0) || (a <= 0 && b >= 0);
    }
    case 'type_is':
      return refsOf(actual).some((r) => r.type === expected);
    case 'type_is_not':
      return !refsOf(actual).some((r) => r.type === expected);
    case 'name_is':
      return namesOf(actual).some((n) => n.toLowerCase() === String(expected).toLowerCase());
    case 'name_contains':
      return namesOf(actual).some((n) => n.toLowerCase().includes(String(expected).toLowerCase()));
    case 'name_not_contains':
      return !namesOf(actual).some((n) => n.toLowerCase().includes(String(expected).toLowerCase()));
    default:
      // The relative and calendar date operators are not modelled: they need a clock, and a widget
      // that wants them can serialise them and hit a real site.
      throw new SgApiError(400, null, `MockClient does not implement the '${operator}' relation.`);
  }
}

function asList(value: unknown): unknown[] {
  // `in` and `not_in` take a list, but a bare scalar also works on a date (field_types/date).
  return Array.isArray(value) ? value : [value];
}

/** On an entity grouping the label is the target's display name, not the whole hash (020_summarize). */
function groupLabel(value: unknown): string {
  if (value !== null && typeof value === 'object' && 'type' in (value as EntityRef)) {
    const ref = value as EntityRef;
    return ref.name ?? `${ref.type} #${ref.id}`;
  }
  return String(value);
}

function toStatusIcon(values: Record<string, unknown>): StatusIcon | null {
  switch (values['display_type']) {
    case 'image_map':
      return { displayType: 'image_map', imageMapKey: String(values['image_map_key'] ?? '') };
    case 'image':
      return { displayType: 'image', dataUrl: String(values['url'] ?? '').replace(/\s+/g, '') };
    case 'html':
      return { displayType: 'html', html: String(values['html'] ?? '') };
    default:
      return null;
  }
}
