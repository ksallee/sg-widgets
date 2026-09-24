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
  BatchRequest,
  BatchResult,
  EntityRow,
  EntityTypeInfo,
  EventLogOptions,
  EventLogResult,
  FollowingOptions,
  HierarchyNode,
  HierarchyPath,
  SearchOptions,
  SearchResult,
  SgClient,
  SummarizeOptions,
  SummarizeResult,
  SummaryGroup,
  TextSearchRow,
  ThreadAuthor,
  ThreadRow,
  UploadFile,
  UploadResult,
} from './client.js';
import { EVENT_LOG_FIELDS, eventLogFilters, normalizeEventLogEntry, SgApiError } from './client.js';
import { pluralPath } from './entity-path.js';
import type { EntityRef, TextSearchFilter, WireCondition, WireGroup } from './filter.js';
import { toFilterArray } from './filter.js';
import type { Operator, TimeUnit } from './field-types.js';
import { isFilterable, isLinkType, isNumericType, NEGATING_OPERATORS, operatorsFor, TIME_UNITS } from './field-types.js';
import type { FieldSchema } from './schema.js';
import { displayNameOf, fieldSchemaOverride } from './schema.js';
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
  /**
   * What `in_last`, `in_next` and `in_calendar_*` resolve against: an ISO string,
   * epoch milliseconds, or a function read on every call. Default: the current time.
   * Fixture dates are offsets from `MOCK_NOW`, so pin it there to filter them.
   */
  now?: string | number | (() => number);
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
  /**
   * Flagged `editable: false` and still taken by a create: `created_at` and
   * `updated_at` are stored as sent on a `POST` and 400 on a `PUT` with
   * `is editable on create only` (070_authored_timestamps), as `this_file` does
   * (entity_types/Attachment).
   */
  createOnly?: boolean;
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
/** A Note is created `opn`; the open set is what the `open_notes_count` rollups count (entity_types/Note). */
const NOTE_STATUSES = ['opn', 'clsd'];
/** Attachment's own list on the probed site, `na` the default (entity_types/Attachment). */
const ATTACHMENT_STATUSES = ['fin', 'na'];
const NOTE_TYPES = ['Client', 'Internal', 'Direction'];

/** `display_values` is per site, not per type; a missing key falls back to the raw code (009_status_lists). */
const STATUS_DISPLAY: Record<string, string> = {
  na: 'N/A', rev: 'Pending Review', vwd: 'Viewed', apr: 'Approved', custom: 'CustomIcon',
  fin: 'Final', ip: 'In Progress', clsd: 'Closed', cmpt: 'Complete', cfrm: 'Confirmed',
  pndad: 'Pending Art Director', pndl: 'Pending Lead', pndvs: 'Pending VFX Supervisor',
  part: 'partial', pass: 'pass', pndng: 'Pending', wtg: 'Waiting to Start', hld: 'On Hold',
  omt: 'Omitted', dis: 'Discarded', ready: 'Ready to Start', act: 'Active', opn: 'Open',
};

/** `bg_color` is comma-separated decimal RGB, never hex (010_status_icons). */
const STATUS_BG: Record<string, string> = {
  na: '150,150,150', wtg: '178,178,178', ready: '120,190,240', ip: '43,139,214',
  rev: '250,190,53', vwd: '154,113,190', apr: '25,118,27', fin: '80,143,66',
  cmpt: '25,118,27', cfrm: '52,152,219', clsd: '90,90,90', hld: '224,80,80',
  omt: '128,128,128', dis: '160,160,160', part: '200,150,50', pass: '100,180,100',
  pndad: '236,151,31', pndl: '236,151,31', pndvs: '236,151,31', pndng: '236,151,31',
  custom: '255,105,180', act: '25,118,27', opn: '236,151,31',
};

/** A 1x1 png, standing in for the one `display_type: image` icon the probed site had. */
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const ASSET_TYPES = ['Character', 'Environment', 'Prop', 'Vehicle', 'FX', 'Matte Painting'];
const SHOT_TYPES = ['VFX', '2D', 'Full CG', 'Trailer', 'Marketing', 'Look Dev'];
const VERSION_TYPES = ['Type A', 'Type B', 'Type C'];
/** Decimal `r,g,b`, the only form a colour field stores (field_types/color). */
const BAR_COLORS = ['253,94,99', '110,180,200', '240,190,90', '90,200,160'];
/** Project's own status field is a plain `list` with no Status row behind it (entity_types/Project). */
const PROJECT_STATUSES = ['Active', 'Bidding', 'Complete', 'On Hold'];

const AUDIT: Record<string, FieldSpec> = {
  id: { displayName: 'Id', dataType: 'number', editable: false },
  cached_display_name: { displayName: 'Display Name', dataType: 'text' },
  created_at: { displayName: 'Date Created', dataType: 'date_time', editable: false, createOnly: true },
  updated_at: { displayName: 'Date Updated', dataType: 'date_time', editable: false, createOnly: true },
  created_by: { displayName: 'Created by', dataType: 'entity', editable: false, validTypes: ['HumanUser', 'ApiUser'] },
  updated_by: { displayName: 'Updated by', dataType: 'entity', editable: false, validTypes: ['HumanUser', 'ApiUser'] },
};

function statusSpec(validValues: string[], defaultValue: string, mandatory = false): FieldSpec {
  return {
    displayName: 'Status',
    dataType: 'status_list',
    validValues,
    displayValues: Object.fromEntries(validValues.map((c) => [c, STATUS_DISPLAY[c] ?? c])),
    defaultValue,
    mandatory,
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
    // A colour is the decimal `r,g,b` the field stores, never hex (field_types/color).
    sg_bar_color: { displayName: 'Bar Colour', dataType: 'color' },
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
  Note: {
    ...AUDIT,
    // `subject` is the title and `content` the body, and `cached_display_name` is
    // `"<subject> - <content>"` when both are set (entity_types/Note).
    subject: { displayName: 'Subject', dataType: 'text', mandatory: true },
    content: { displayName: 'Body', dataType: 'text' },
    // A site is free to flag a status field mandatory, and Note's commonly is. The probed
    // site's Version status reads `mandatory: false` (probe 009); the flag is per site and
    // per field, so a widget reads it rather than assuming either way.
    sg_status_list: statusSpec(NOTE_STATUSES, 'opn', true),
    sg_note_type: { displayName: 'Note Type', dataType: 'list', validValues: NOTE_TYPES },
    // The codes `unread` and `read`, never a boolean (067_notes_in_the_stream).
    read_by_current_user: { displayName: 'Read by Current User', dataType: 'list', validValues: ['unread', 'read'] },
    publish_status: { displayName: 'Publish Status', dataType: 'text' },
    project: { displayName: 'Project', dataType: 'entity', validTypes: ['Project'] },
    user: { displayName: 'Author', dataType: 'entity', validTypes: ['HumanUser', 'ApiUser'] },
    // Site configuration on a real site, 36 types on the probed one, and not enforced.
    note_links: { displayName: 'Link', dataType: 'multi_entity', validTypes: ['Shot', 'Asset', 'Sequence', 'Version', 'Playlist'] },
    // A Note about a Task goes here: `Task` is absent from `note_links` (entity_types/Note).
    tasks: { displayName: 'Tasks', dataType: 'multi_entity', validTypes: ['Task'] },
    replies: { displayName: 'Replies', dataType: 'multi_entity', validTypes: ['Reply'] },
    attachments: { displayName: 'Attachments', dataType: 'multi_entity', validTypes: ['Attachment'] },
    addressings_to: { displayName: 'To', dataType: 'multi_entity', validTypes: ['Group', 'HumanUser'] },
    addressings_cc: { displayName: 'Cc', dataType: 'multi_entity', validTypes: ['Group', 'HumanUser'] },
  },
  // Site-wide: seven fields and no `project`, so a filter on one is 400
  // `API read() Reply.project doesn't exist.` (entity_types/Reply). `updated_at` is
  // not among the seven: a create naming it is 400 `doesn't exist` (070_authored_timestamps).
  Reply: {
    id: AUDIT['id'] as FieldSpec,
    cached_display_name: AUDIT['cached_display_name'] as FieldSpec,
    created_at: AUDIT['created_at'] as FieldSpec,
    content: { displayName: 'Reply Text', dataType: 'text', mandatory: true },
    // Nearly every type on the site, which makes it a generic link and not a Note link.
    entity: { displayName: 'Link', dataType: 'entity', validTypes: ['Note', 'Version', 'Shot', 'Asset', 'Task'] },
    user: { displayName: 'Author', dataType: 'entity', validTypes: ['HumanUser', 'ApiUser', 'ClientUser'] },
    publish_status: { displayName: 'Publish Status', dataType: 'text' },
  },
  Attachment: {
    ...AUDIT,
    // There is no `name` field on the type; `display_name` is what a person reads.
    display_name: { displayName: 'File Display Name', dataType: 'text' },
    description: { displayName: 'Description', dataType: 'text' },
    original_fname: { displayName: 'Original Filename', dataType: 'text' },
    // The three read-only ones are refused on create and on update alike (entity_types/Attachment).
    filename: { displayName: 'File Name', dataType: 'text', editable: false },
    file_extension: { displayName: 'File Type', dataType: 'text', editable: false },
    file_size: { displayName: 'File Size', dataType: 'number', editable: false },
    // A `{url, name}` hash on the create is the one body that makes a usable row; a
    // second write is `is editable on create only` (entity_types/Attachment).
    this_file: { displayName: 'Link', dataType: 'url', editable: false, createOnly: true },
    processing_status: { displayName: 'Processing Status', dataType: 'list', editable: false, validValues: ['thumbnail_pending', 'unverified', 'clean', 'infected'] },
    sg_status_list: statusSpec(ATTACHMENT_STATUSES, 'na'),
    project: { displayName: 'Project', dataType: 'entity', validTypes: ['Project'] },
    attachment_links: { displayName: 'Attachment Links', dataType: 'multi_entity', validTypes: ['Note', 'Version', 'Shot', 'Asset', 'Sequence', 'Delivery'] },
  },
  // Every field is server-written, `meta` says what changed, and `audit_trail` is
  // never returned even when it is named (025_event_log).
  EventLogEntry: {
    id: AUDIT['id'] as FieldSpec,
    cached_display_name: AUDIT['cached_display_name'] as FieldSpec,
    created_at: AUDIT['created_at'] as FieldSpec,
    event_type: { displayName: 'Event Type', dataType: 'text', editable: false },
    attribute_name: { displayName: 'Attribute Name', dataType: 'text', editable: false },
    description: { displayName: 'Description', dataType: 'text', editable: false },
    // `serializable`: readable, and 400 `cannot be used in a filter` on every operator.
    meta: { displayName: 'Meta', dataType: 'serializable', editable: false },
    session_uuid: { displayName: 'Session UUID', dataType: 'uuid', editable: false },
    entity: { displayName: 'Entity', dataType: 'entity', editable: false, validTypes: ['Shot', 'Asset', 'Sequence', 'Version', 'Task', 'Note', 'Reply', 'Project'] },
    project: { displayName: 'Project', dataType: 'entity', editable: false, validTypes: ['Project'] },
    user: { displayName: 'User', dataType: 'entity', editable: false, validTypes: ['HumanUser', 'ApiUser'] },
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

/**
 * The identity field per type. It is flagged `mandatory` and is optional on a
 * create; the server fills it with `New <display name> <id>` on the types below,
 * and a Note is left titleless (012_create_version, entity_types/Note).
 */
const IDENTITY_FIELD: Record<string, string> = {
  Project: 'name', Sequence: 'code', Shot: 'code', Asset: 'code', Version: 'code',
  Task: 'content', Note: 'subject', Reply: 'content', Attachment: 'display_name',
};

const GENERATED_IDENTITY: ReadonlySet<string> = new Set(['Sequence', 'Shot', 'Asset', 'Version', 'Task']);

const DISPLAY_NAMES: Record<string, string> = {
  Project: 'Project', Sequence: 'Sequence', Shot: 'Shot', Asset: 'Asset', Version: 'Version',
  Task: 'Task', HumanUser: 'Person', ApiUser: 'Script', Step: 'Pipeline Step',
  Status: 'Status', Icon: 'Icon', Note: 'Note', Reply: 'Reply', Attachment: 'Attachment',
  EventLogEntry: 'Event Log Entry',
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

/** The mock site's today. Every fixture date is an offset in days from it. */
const EPOCH = Date.UTC(2026, 0, 5);

/** Midday on the mock site's today, for a caller pinning `now` so relative-date filters land on the fixtures. */
export const MOCK_NOW = `${new Date(EPOCH + 12 * 3_600_000).toISOString().slice(0, 19)}Z`;

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

/** The web root of the mock site, which is where a transcoding placeholder lives. */
const MOCK_SITE_URL = 'https://mock.example.studio';

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
  /** What each HumanUser follows, by user id. A follow is a link and carries no date. */
  follows: Map<number, EntityRef[]>;
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

/**
 * The threads. `day` and the minute offsets place every row of a thread on one
 * timeline, so the Note, its Attachments and its Replies interleave in time order
 * the way `thread_contents` returns them.
 */
const NOTE_SEEDS = [
  {
    subject: 'Key light reads flat',
    content: 'The key reads flat against the plate. Warmer, and a stop down.',
    day: -6,
    author: 0,
    status: 'opn',
    read: 'unread',
    noteType: 'Internal',
    attachments: [
      { filename: 'key_light_ref.png', minutes: 2 },
      { filename: 'plate_compare.png', minutes: 60 },
    ],
    replies: [
      { author: 2, minutes: 45, content: 'Warmed it by 300K and dropped the key.' },
      { author: 0, minutes: 90, content: 'Better. Leave the rim where it is.' },
    ],
  },
  {
    subject: 'Comp edges on the rotoscope',
    content: 'The left edge tears on frame 1042.',
    day: -4,
    author: 2,
    status: 'opn',
    read: 'unread',
    noteType: 'Client',
    attachments: [{ filename: 'frame_1042.png', minutes: 5 }],
    replies: [{ author: 5, minutes: 200, content: 'Repainted the edge and pushed a new version.' }],
  },
  {
    subject: 'Approved for the reel',
    content: 'Nothing else from me.',
    day: -3,
    author: 7,
    status: 'clsd',
    read: 'read',
    noteType: 'Internal',
    attachments: [],
    replies: [],
  },
  {
    subject: 'Dust pass is too heavy',
    content: 'Half the density and keep the drift.',
    day: -2,
    author: 3,
    status: 'opn',
    read: 'read',
    noteType: 'Direction',
    attachments: [],
    replies: [
      { author: 5, minutes: 30, content: 'Halved it.' },
      { author: 3, minutes: 120, content: 'That reads.' },
    ],
  },
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
  const allCodes = [
    ...new Set([...VERSION_STATUSES, ...TASK_STATUSES, ...SHOT_STATUSES, ...SEQUENCE_STATUSES, ...USER_STATUSES, ...NOTE_STATUSES, ...ATTACHMENT_STATUSES]),
  ];
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
        // One Shot with no picture, so a list of them reaches the type glyph.
        image: shotId === 865 ? null : thumb(code),
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
  const versions: Row[] = [];
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
    const version = add('Version', versionId, {
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
      // Every seventh Version has no picture: 99 of 100 read null on the sample project (field_types/image).
      image: i % 7 === 3 ? null : thumb(code),
      sg_uploaded_movie: null,
      sg_bar_color: pick(rng, BAR_COLORS),
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
    versions.push(version);
    versionId += 1;
  }

  /* notes, replies and attachments ------------------------------------------ */
  // The link to a Note lives on the Reply, in `Reply.entity`; `Note.replies` is the
  // reverse view of it (entity_types/Reply). An Attachment links back through
  // `attachment_links` (entity_types/Attachment).
  const notes: Row[] = [];
  /** Each Reply with the day and minute it was written, for the event log below. */
  const replies: Array<{ row: Row; day: number; minutes: number }> = [];
  let noteId = 11030;
  let replyId = 610;
  let attachmentId = 2626;
  NOTE_SEEDS.forEach((seed, i) => {
    // One thread in the second project, so a per-project read has something to cut.
    const target = versions[i === 3 ? 23 : i * 5] ?? (shots[i] as Row);
    const project = target.values['project'] as EntityRef;
    const author = users[seed.author] as Row;
    const addressed = users[(seed.author + 1) % users.length] as Row;
    const note = add('Note', noteId, {
      subject: seed.subject,
      content: seed.content,
      // `cached_display_name` is `"<subject> - <content>"` when both are set (entity_types/Note).
      cached_display_name: `${seed.subject} - ${seed.content}`,
      sg_status_list: seed.status,
      sg_note_type: seed.noteType,
      // The codes `unread` and `read`, never a boolean (067_notes_in_the_stream).
      read_by_current_user: seed.read,
      publish_status: 'published',
      project,
      user: ref(author),
      note_links: [ref(target)],
      tasks: [],
      replies: [],
      attachments: [],
      addressings_to: [ref(addressed)],
      addressings_cc: [],
      created_at: isoDateTime(seed.day),
      updated_at: isoDateTime(seed.day),
      created_by: ref(author),
      updated_by: ref(author),
    });
    for (const file of seed.attachments) {
      const attachment = add('Attachment', attachmentId, {
        display_name: file.filename,
        cached_display_name: file.filename,
        description: null,
        original_fname: file.filename,
        filename: file.filename,
        // Neither fills in on an uploaded row; take the size from the bytes you sent
        // and the extension from the filename (entity_types/Attachment).
        file_extension: null,
        file_size: null,
        this_file: { url: `https://media.example.studio/${file.filename}`, name: file.filename, content_type: 'image/png', link_type: 'upload' },
        processing_status: null,
        sg_status_list: 'na',
        project,
        attachment_links: [ref(note)],
        created_at: isoDateTime(seed.day, file.minutes * 60),
        updated_at: isoDateTime(seed.day, file.minutes * 60),
        created_by: ref(author),
        updated_by: ref(author),
      });
      (note.values['attachments'] as EntityRef[]).push(ref(attachment));
      attachmentId += 1;
    }
    for (const seeded of seed.replies) {
      const replyAuthor = users[seeded.author] as Row;
      const reply = add('Reply', replyId, {
        content: seeded.content,
        // Filled from `content` at create time, and it is what `Note.replies` returns as a name.
        cached_display_name: seeded.content,
        entity: ref(note),
        user: ref(replyAuthor),
        publish_status: 'published',
        created_at: isoDateTime(seed.day, seeded.minutes * 60),
        updated_at: isoDateTime(seed.day, seeded.minutes * 60),
      });
      (note.values['replies'] as EntityRef[]).push(ref(reply));
      replies.push({ row: reply, day: seed.day, minutes: seeded.minutes });
      replyId += 1;
    }
    notes.push(note);
    noteId += 1;
  });

  /* the event log ----------------------------------------------------------- */
  const pending: Array<{ day: number; seconds: number; values: Record<string, unknown> }> = [];
  const event = (day: number, seconds: number, values: Record<string, unknown>): void => {
    pending.push({ day, seconds, values });
  };
  const changed = (row: Row, oldValue: string, day: number, seconds: number, user: Row): void => {
    const newValue = row.values['sg_status_list'];
    event(day, seconds, {
      event_type: `Shotgun_${row.type}_Change`,
      attribute_name: 'sg_status_list',
      description: `${displayNameOf(user.values, '')} changed "Status" from "${oldValue}" to "${String(newValue)}" on ${row.type} ${displayNameOf(row.values, '')}`,
      // `old_value` and `new_value` exist where `meta.type` is `attribute_change` and
      // nowhere else (025_event_log).
      meta: {
        type: 'attribute_change',
        attribute_name: 'sg_status_list',
        entity_type: row.type,
        entity_id: row.id,
        in_create: false,
        field_data_type: 'status_list',
        old_value: oldValue,
        new_value: newValue,
        platform_id: null,
      },
      entity: ref(row),
      project: row.values['project'] as EntityRef,
      user: ref(user),
    });
  };
  const created = (row: Row, day: number, seconds: number, user: Row, extra: Record<string, unknown> = {}): void => {
    event(day, seconds, {
      event_type: `Shotgun_${row.type}_New`,
      attribute_name: null,
      description: `${displayNameOf(user.values, '')} created ${row.type} ${displayNameOf(row.values, '')}`,
      meta: { type: 'new_entity', entity_type: row.type, entity_id: row.id, ...extra },
      entity: ref(row),
      project: (row.values['project'] as EntityRef | undefined) ?? null,
      user: ref(user),
    });
  };
  shots.slice(0, 6).forEach((shot, i) => changed(shot, 'wtg', -9 + i, 3600 + i * 137, users[i % users.length] as Row));
  versions.slice(0, 4).forEach((version, i) => changed(version, 'rev', -5 + i, 7200 + i * 211, activeUsers[i % activeUsers.length] as Row));
  tasks.slice(0, 3).forEach((task, i) => changed(task, 'wtg', -7 + i, 5400 + i * 97, activeUsers[(i + 1) % activeUsers.length] as Row));
  notes.forEach((note, i) => {
    const author = index.get(`HumanUser:${(note.values['user'] as EntityRef).id}`) as Row;
    created(note, NOTE_SEEDS[i]?.day ?? 0, 30, author);
  });
  for (const { row: reply, day, minutes } of replies) {
    const author = index.get(`HumanUser:${(reply.values['user'] as EntityRef).id}`) as Row;
    const note = index.get(`Note:${(reply.values['entity'] as EntityRef).id}`) as Row;
    event(day, minutes * 60, {
      event_type: 'Shotgun_Reply_New',
      attribute_name: null,
      description: `${displayNameOf(author.values, '')} replied to Note ${displayNameOf(note.values, '')}`,
      // A `new_entity` meta carries the row's id and its content, and no values.
      meta: { type: 'new_entity', entity_type: 'Reply', entity_id: reply.id, content: reply.values['content'] },
      entity: ref(reply),
      project: note.values['project'] as EntityRef,
      user: ref(author),
    });
  }
  // `entity` goes null when its target is deleted and `meta` remembers, so a deleted
  // row's history is reachable by `event_type` and `created_at` alone (025_event_log).
  event(-30, 0, {
    event_type: 'Shotgun_Shot_Change',
    attribute_name: 'sg_status_list',
    description: 'A shot that no longer exists changed "Status" from "ip" to "omt"',
    meta: {
      type: 'attribute_change',
      attribute_name: 'sg_status_list',
      entity_type: 'Shot',
      entity_id: 9001,
      in_create: false,
      field_data_type: 'status_list',
      old_value: 'ip',
      new_value: 'omt',
      platform_id: null,
    },
    entity: null,
    project: ref(p0),
    user: ref(bot),
  });
  pending.sort((a, b) => a.day * 86_400 + a.seconds - (b.day * 86_400 + b.seconds));
  // Ids ascend with time, and the head is sparse: blocks are reserved ahead of use and
  // fill in later, so a cursor on `max(id)` loses what lands in a gap (025_event_log).
  let eventId = 1_240_000;
  for (const entry of pending) {
    add('EventLogEntry', eventId, {
      cached_display_name: null,
      session_uuid: `7a1b2c3d-0000-4000-8000-${String(eventId).padStart(12, '0')}`,
      created_at: isoDateTime(entry.day, entry.seconds),
      ...entry.values,
    });
    eventId += eventId % 7 === 0 ? 3 : 1;
  }

  /* what each person follows ------------------------------------------------- */
  // A follow is a type and an id and nothing else: no name, and no date the follow
  // started (get_entity_human_users_id_following).
  const follows = new Map<number, EntityRef[]>();
  const follow = (userRef: EntityRef | null | undefined, row: Row): void => {
    if (!userRef || userRef.type !== 'HumanUser') return;
    const list = follows.get(userRef.id) ?? [];
    if (!list.some((r) => r.type === row.type && r.id === row.id)) list.push(ref(row));
    follows.set(userRef.id, list);
  };
  for (const note of notes) {
    follow(note.values['user'] as EntityRef, note);
    for (const to of note.values['addressings_to'] as EntityRef[]) follow(to, note);
  }
  for (const { row: reply } of replies) {
    const note = index.get(`Note:${(reply.values['entity'] as EntityRef).id}`);
    if (note) follow(reply.values['user'] as EntityRef, note);
  }
  for (const task of tasks) {
    for (const assignee of task.values['task_assignees'] as EntityRef[]) follow(assignee, task);
  }

  return { rows, index, follows };
}

/* -------------------------------------------------------------------------- */
/* the client                                                                 */
/* -------------------------------------------------------------------------- */

export class MockClient implements SgClient {
  private readonly fixtures: Fixtures;
  private readonly latencyMs: number;
  private readonly clock: () => number;
  private pendingFailure: MockFailure | null;
  /** Rows a delete retired, by `Type:id`. Reads skip them and a revive puts them back. */
  private readonly retired = new Map<string, Row>();
  /** Rows a batch created with no `project`: no read reaches them, a delete does (report 001). */
  private readonly unreadable = new Map<string, Row>();
  private deletes = 0;

  constructor(options: MockClientOptions = {}) {
    this.fixtures = buildFixtures(options.seed ?? 1, options.counts ?? {});
    this.latencyMs = options.latencyMs ?? 0;
    this.clock = toClock(options.now);
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
      // The same correction a schema read gets, so the mock answers the schema a client sees.
      out[name] = { ...field, ...fieldSchemaOverride(entityType, name) };
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
    return this.updateRow(entityType, id, patch);
  }

  private updateRow(entityType: string, id: number, patch: Record<string, unknown>): EntityRow {
    const spec = this.schemaOf(entityType);
    const row = this.fixtures.index.get(`${entityType}:${id}`);
    // The 404 names the type and the id (put_entity_type_id).
    if (!row) throw new SgApiError(404, null, `Entity of type [${entityType}] with id=${id} does not exist.`);
    for (const [name, value] of Object.entries(patch)) {
      const field = spec[name];
      // `API create() Reply.project doesn't exist.` is the create spelling of this 400
      // (entity_types/Reply); a write to a read-only field is `is read only.` (entity_types/Sequence).
      if (!field) throw new SgApiError(400, null, `API update() ${entityType}.${name} doesn't exist.`);
      if (field.createOnly) throw new SgApiError(400, null, `API update() ${entityType}.${name} is editable on create only.`);
      if (field.editable === false) throw new SgApiError(400, null, `API update() ${entityType}.${name} is read only.`);
      this.checkLink('update', entityType, name, field, value);
      // Writing "" to a text field stores null: the two are one value (field_types/text).
      row.values[name] = field.dataType === 'text' && value === '' ? null : value;
    }
    if (spec['updated_at'] && Object.keys(patch).length > 0) row.values['updated_at'] = isoDateTime(0);
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
    this.refuseGrouping(entityType, grouping.field);

    const buckets = new Map<string, { value: unknown; rows: Row[] }>();
    const put = (value: unknown, row: Row) => {
      const key = value === null || value === undefined ? '' : JSON.stringify(value);
      const bucket = buckets.get(key);
      if (bucket) bucket.rows.push(row);
      else buckets.set(key, { value, rows: [row] });
    };
    for (const row of matched) {
      const raw = this.walk(row, grouping.field, false)[0] ?? null;
      // A multi_entity row is grouped on its whole set of links, as an array of references;
      // the corpus has not measured that grouping.
      const value = Array.isArray(raw) ? (raw.length === 0 ? null : raw.map((one) => this.groupValueOf(one))) : this.groupValueOf(raw);
      put(value, row);
    }
    const groups: SummaryGroup[] = [...buckets.entries()].map(([, bucket]) => ({
      groupName: bucket.value === null ? '' : Array.isArray(bucket.value) ? bucket.value.map(groupLabel).join(', ') : groupLabel(bucket.value),
      groupValue: bucket.value,
      summaries: summarize(bucket.rows),
    }));
    groups.sort((a, b) => (a.groupName < b.groupName ? -1 : a.groupName > b.groupName ? 1 : 0));
    if (grouping.direction === 'desc') groups.reverse();
    return { summaries: summarize(matched), groups };
  }

  /** An entity group's value is the reference with its name and `valid` (020_summarize); a code is itself. */
  private groupValueOf(value: unknown): unknown {
    if (value === null || typeof value !== 'object' || !('type' in value)) return value;
    return { ...(this.decorate(value) as EntityRef), valid: 'valid' };
  }

  /**
   * A field the server cannot group is 400 `Grouping is not allowed for field
   * <Type>.<field>.` on `image` and `summary` (field_types/image, field_types/summary),
   * and a `pivot_column` is 500 (field_types/pivot_column). `Note.read_by_current_user`,
   * the per-person read state, is refused the same way; the corpus has not measured it.
   */
  private refuseGrouping(entityType: string, field: string): void {
    const dataType = SPECS[entityType]?.[field]?.dataType;
    if (dataType === 'pivot_column') throw new SgApiError(500, null, 'Shotgun Server Error');
    const refused = dataType === 'image' || dataType === 'summary' || (entityType === 'Note' && field === 'read_by_current_user');
    if (refused) throw new SgApiError(400, null, `Grouping is not allowed for field ${entityType}.${field}.`);
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

  /**
   * Create one row and answer it.
   *
   * `project` is the whole contract on a project-scoped type, and the schema's
   * `mandatory` flags are not it: the identity field is optional and the server
   * fills it, except on a Note, which stays titleless (012_create_version,
   * entity_types/Note). Nothing is unique, so two identical creates make two rows.
   */
  async create(entityType: string, body: Record<string, unknown>): Promise<EntityRow> {
    await this.gate();
    return this.createRow(entityType, body, false);
  }

  /**
   * A create, alone or inside a batch. The batch skips the `project` check and stores
   * the row where no read reaches it (report 001), and it spells an unknown field its
   * own way (recipes/002).
   */
  private createRow(entityType: string, body: Record<string, unknown>, inBatch: boolean): EntityRow {
    const spec = this.schemaOf(entityType);
    const orphan = spec['project'] !== undefined && body['project'] === undefined;
    // `{}` and the identity field alone both answer this, with the body echoed.
    if (orphan && !inBatch) {
      throw new SgApiError(400, null, `API create() missing 'project' attribute: ${JSON.stringify(body)}`);
    }
    const identity = IDENTITY_FIELD[entityType];
    for (const [name, value] of Object.entries(body)) {
      const field = spec[name];
      if (!field && inBatch) {
        throw new SgApiError(
          400,
          null,
          `Invalid field value, update failed [2 - Invalid field name: field [${entityType}.${name}] does not exist or user does not have access permission.]`,
        );
      }
      if (!field) throw new SgApiError(400, null, `API create() ${entityType}.${name} doesn't exist.`);
      if (field.editable === false && !field.createOnly) throw new SgApiError(400, null, `API create() ${entityType}.${name} is read only.`);
      this.checkLink('create', entityType, name, field, value);
      // Omitting the identity field and sending an empty one are different (entity_types/Shot).
      if (name === identity && value === '') {
        throw new SgApiError(400, null, `Create failed for [${entityType}]: Cannot set identifier field to empty. (${entityType})`);
      }
    }
    const id = this.nextId(entityType);
    const values: Record<string, unknown> = {};
    for (const [name, field] of Object.entries(spec)) {
      // `default_value` applies when the key is omitted, so a status is never unset.
      values[name] = field.dataType === 'multi_entity' ? [] : (field.defaultValue ?? null);
    }
    // `user` and `created_by` hold the authenticating user (entity_types/Note).
    const author = this.fixtures.rows.get('ApiUser')?.[0];
    const authored = author ? ref(author) : null;
    if (spec['created_by']) values['created_by'] = authored;
    if (spec['updated_by']) values['updated_by'] = authored;
    if (spec['user']) values['user'] = authored;
    // The 201 echoes the server's defaults: a fresh Note is `unread` and `published`
    // (entity_types/Note), and so is a Reply (entity_types/Reply).
    if (spec['read_by_current_user']) values['read_by_current_user'] = 'unread';
    if (spec['publish_status']) values['publish_status'] = 'published';
    values['created_at'] = isoDateTime(0);
    if (spec['updated_at']) values['updated_at'] = isoDateTime(0);
    // An authored `created_at` or `updated_at` in the body is stored as sent (070_authored_timestamps).
    Object.assign(values, body, { id });
    if (identity && values[identity] === null && GENERATED_IDENTITY.has(entityType)) {
      values[identity] = `New ${DISPLAY_NAMES[entityType] ?? entityType} ${id}`;
    }
    values['cached_display_name'] =
      entityType === 'Note'
        ? [values['subject'], values['content']].filter(Boolean).join(' - ')
        : displayNameOf({ ...values, cached_display_name: null }, '');
    const row: Row = { type: entityType, id, values };
    if (orphan) {
      this.unreadable.set(`${entityType}:${id}`, row);
      return this.project(row, spec);
    }
    const rows = this.fixtures.rows.get(entityType);
    if (rows) rows.push(row);
    else this.fixtures.rows.set(entityType, [row]);
    this.fixtures.index.set(`${entityType}:${id}`, row);
    this.linkBack(row);
    return this.project(row, spec);
  }

  /**
   * Retire one row: reads skip it and a second delete is 404 (delete_entity_type_id).
   * The mock retires only the row; what a delete does to rows that link to it
   * (probe 060, 089_task_delete_side_effects) is not modelled.
   */
  async delete(entityType: string, id: number): Promise<void> {
    await this.gate();
    this.deleteRow(entityType, id);
  }

  private deleteRow(entityType: string, id: number): void {
    this.schemaOf(entityType);
    const key = `${entityType}:${id}`;
    const row = this.fixtures.index.get(key) ?? this.unreadable.get(key);
    if (!row) throw new SgApiError(404, null, `Entity of type [${entityType}] with id=${id} does not exist.`);
    this.unreadable.delete(key);
    this.fixtures.index.delete(key);
    const rows = this.fixtures.rows.get(entityType) ?? [];
    const at = rows.indexOf(row);
    if (at >= 0) rows.splice(at, 1);
    this.retired.set(key, row);
  }

  /** Bring a retired row back with its values; `false` for a row that is already live (post_entity_type_id). */
  async revive(entityType: string, id: number): Promise<boolean> {
    await this.gate();
    this.schemaOf(entityType);
    const key = `${entityType}:${id}`;
    if (this.fixtures.index.has(key)) return false;
    const row = this.retired.get(key);
    if (!row) throw new SgApiError(404, null, `Entity of type [${entityType}] with id=${id} does not exist.`);
    this.retired.delete(key);
    const rows = this.fixtures.rows.get(entityType) ?? [];
    const at = rows.findIndex((r) => r.id > id);
    rows.splice(at < 0 ? rows.length : at, 0, row);
    this.fixtures.rows.set(entityType, rows);
    this.fixtures.index.set(key, row);
    return true;
  }

  /**
   * Apply the requests in order, and undo all of them when one fails (recipes/002).
   * A create or update row carries the record under `data`; a delete row is flat.
   */
  async batch(requests: BatchRequest[]): Promise<BatchResult[]> {
    await this.gate();
    const restore = this.snapshot();
    try {
      return requests.map((request, i) => this.batchOne(request, i));
    } catch (error) {
      restore();
      throw error;
    }
  }

  private batchOne(request: BatchRequest, i: number): BatchResult {
    const invalid = (source: Record<string, unknown>): SgApiError =>
      new SgApiError(400, { errors: [{ status: 400, code: 103, title: 'Request Parameters invalid.', source }] }, 'Request Parameters invalid.');
    const kind = request.request_type as string;
    if (kind !== 'create' && kind !== 'update' && kind !== 'delete') {
      throw invalid({ requests: { [i]: { request_type: ['request_type must be one of: create, update, delete'] } } });
    }
    if (!request.entity) throw invalid({ requests: { [i]: { entity: ['entity is missing'] } } });
    // The URL slug or any other unknown name reads as an empty type (recipes/002).
    if (!SPECS[request.entity]) throw new SgApiError(400, null, 'Invalid entity type: entity type [] does not exist.');
    // A missing `record_id` is read as 0, which no row has (recipes/002).
    const id = 'record_id' in request ? (request.record_id ?? 0) : 0;
    if (request.request_type === 'delete') {
      this.deleteRow(request.entity, id);
      this.deletes += 1;
      const uuid = `00000000-0000-4000-8000-${this.deletes.toString(16).padStart(12, '0')}`;
      return { request_type: 'delete', type: request.entity, id, uuid, did_delete: true };
    }
    const data = request.data as Record<string, unknown> | undefined;
    if (data === null || typeof data !== 'object') {
      throw invalid({ data: ['data hash containing field/value pairs is required for the given request'] });
    }
    if (request.request_type === 'create') return { request_type: 'create', data: this.createRow(request.entity, data, true) };
    return { request_type: 'update', data: this.updateRow(request.entity, id, data) };
  }

  /** Everything a batch can change, and a function that puts it back. */
  private snapshot(): () => void {
    const rows = new Map([...this.fixtures.rows].map(([type, list]) => [type, [...list]] as const));
    const index = new Map(this.fixtures.index);
    const values = new Map([...index.values()].map((row) => [row, structuredClone(row.values)] as const));
    const retired = new Map(this.retired);
    const unreadable = new Map(this.unreadable);
    const deletes = this.deletes;
    const refill = <K, V>(target: Map<K, V>, from: Map<K, V>): void => {
      target.clear();
      for (const [k, v] of from) target.set(k, v);
    };
    return () => {
      refill(this.fixtures.rows, rows);
      refill(this.fixtures.index, index);
      for (const [row, saved] of values) row.values = saved;
      refill(this.retired, retired);
      refill(this.unreadable, unreadable);
      this.deletes = deletes;
    };
  }

  /**
   * Put a file on a row, as the three-call handshake leaves the site.
   *
   * The field in the path picks the kind: `image` a Thumbnail, another field an
   * Attachment on it, no field a generic Attachment on `attachment_links`
   * (recipes/001). The mock moves no bytes, so there is no `ETag` to give back.
   */
  async upload(entityType: string, id: number, file: UploadFile): Promise<UploadResult> {
    await this.gate();
    const spec = this.schemaOf(entityType);
    const target = this.fixtures.index.get(`${entityType}:${id}`);
    if (!target) throw new SgApiError(404, null, `Entity of type [${entityType}] with id=${id} does not exist.`);
    // `filename` is a required query parameter on the ticket call.
    if (!file.filename) throw new SgApiError(400, { filename: ['filename is missing'] }, 'Request Parameters invalid.');
    // The 404 for a field the type does not have is worded as a missing field.
    if (file.field !== undefined && !spec[file.field]) {
      throw new SgApiError(404, null, `Field '${entityType}.${file.field}' does not exist.`);
    }
    const attachmentId = this.nextId('Attachment');
    const author = this.fixtures.rows.get('ApiUser')?.[0];
    const attachment: Row = {
      type: 'Attachment',
      id: attachmentId,
      values: {
        id: attachmentId,
        display_name: file.filename,
        cached_display_name: file.filename,
        description: null,
        original_fname: file.filename,
        filename: file.filename,
        // Neither fills in, then or later (entity_types/Attachment).
        file_extension: null,
        file_size: null,
        this_file: { url: `https://media.example.studio/${file.filename}`, name: file.filename, content_type: 'application/octet-stream', link_type: 'upload' },
        // The token the field answers straight after an upload, which is not one of the
        // four its own `valid_values` declares (entity_types/Attachment).
        processing_status: 'thumbnail_pending_us',
        sg_status_list: 'na',
        project: (target.values['project'] as EntityRef | undefined) ?? null,
        attachment_links: [{ type: entityType, id }],
        created_at: isoDateTime(0),
        updated_at: isoDateTime(0),
        created_by: author ? ref(author) : null,
        updated_by: author ? ref(author) : null,
      },
    };
    const attachments = this.fixtures.rows.get('Attachment');
    if (attachments) attachments.push(attachment);
    else this.fixtures.rows.set('Attachment', [attachment]);
    this.fixtures.index.set(`Attachment:${attachmentId}`, attachment);

    const linkField = file.field ?? (spec['attachments'] ? 'attachments' : undefined);
    const field = linkField === undefined ? undefined : spec[linkField];
    if (linkField !== undefined && field) {
      if (field.dataType === 'multi_entity') (target.values[linkField] as EntityRef[]).push(ref(attachment));
      else if (linkField === 'image') {
        // A media field is not readable yet: it answers an absolute placeholder on the
        // site root under `/images/status/transient/` until the transcode lands
        // (013_upload_media, field_types/image).
        target.values[linkField] = `${MOCK_SITE_URL}/images/status/transient/thumbnail_pending.png`;
      } else target.values[linkField] = String((attachment.values['this_file'] as { url: string }).url);
    }
    const uploadType = file.field === 'image' ? 'Thumbnail' : 'Attachment';
    return {
      uploadType,
      uploadInfo: {
        timestamp: isoDateTime(0),
        upload_type: uploadType,
        upload_id: null,
        storage_service: 's3',
        original_filename: file.filename,
        multipart_upload: false,
      },
      // No bytes were moved, so there is no md5 receipt.
      etag: null,
    };
  }

  /**
   * An entity link is a `{type, id}` hash. A bare id is refused naming the class it
   * got (entity_types/Reply, field_types/entity) and a hash with no `type` naming the
   * missing key (field_types/entity).
   */
  private checkLink(verb: 'create' | 'update', entityType: string, name: string, field: FieldSpec, value: unknown): void {
    if (field.dataType !== 'entity' || value === null || value === undefined) return;
    if (Number.isInteger(value) || typeof value === 'string') {
      const got = typeof value === 'number' ? `Integer: ${value}` : `String: ${JSON.stringify(value)}`;
      throw new SgApiError(
        400,
        null,
        `API ${verb}() ${entityType}.${name} expected [Hash, ActiveSupport::HashWithIndifferentAccess, ActionDispatch::Http::Parameters, ActionDispatch::Http::ParamsHashWithIndifferentAccess, NilClass] data type(s) but got ${got}`,
      );
    }
    if (typeof value === 'object' && !Array.isArray(value) && typeof (value as { type?: unknown }).type !== 'string') {
      throw new SgApiError(400, null, `API ${verb}() invalid/missing entity hash string 'type': ${JSON.stringify(value)}`);
    }
  }

  /** The next free id of a type, which is what a create takes. */
  private nextId(entityType: string): number {
    const live = (this.fixtures.rows.get(entityType) ?? []).reduce((max, row) => Math.max(max, row.id), 0);
    // A retired row keeps its id, so a create never reuses it.
    let taken = live;
    for (const row of [...this.retired.values(), ...this.unreadable.values()]) if (row.type === entityType) taken = Math.max(taken, row.id);
    return taken + 1;
  }

  /** The reverse view of a link the server fills in: a Reply lands in `Note.replies`. */
  private linkBack(row: Row): void {
    const push = (owner: EntityRef | null | undefined, field: string): void => {
      if (!owner) return;
      const target = this.fixtures.index.get(`${owner.type}:${owner.id}`);
      const list = target?.values[field];
      if (Array.isArray(list)) (list as EntityRef[]).push(ref(row));
    };
    if (row.type === 'Reply') push(row.values['entity'] as EntityRef | null, 'replies');
    if (row.type === 'Attachment') {
      for (const link of (row.values['attachment_links'] as EntityRef[] | undefined) ?? []) push(link, 'attachments');
    }
  }

  /**
   * A Note, its Attachments and its Replies in one list in time order.
   *
   * The author key follows the row type, `created_by` on a Note and an Attachment
   * and `user` on a Reply, whose hash carries an avatar the other two do not, and
   * so does what `entityFields` can widen: the Reply entry is accepted and changes
   * nothing (get_entity_notes_id_thread_contents).
   */
  async threadContents(noteId: number, entityFields?: Record<string, string[]>): Promise<ThreadRow[]> {
    await this.gate();
    const note = this.fixtures.index.get(`Note:${noteId}`);
    // The 404 names the Note. On any other type it is worded as a missing field,
    // `Field 'Version.thread_contents' does not exist.`
    if (!note) throw new SgApiError(404, null, `Note: ${noteId} not found`);
    const linked = (field: string, type: string): Row[] =>
      ((note.values[field] as EntityRef[] | undefined) ?? [])
        .map((r) => this.fixtures.index.get(`${type}:${r.id}`))
        .filter((r): r is Row => r !== undefined);
    const rows = [note, ...linked('attachments', 'Attachment'), ...linked('replies', 'Reply')];
    rows.sort((a, b) => {
      const at = String(a.values['created_at'] ?? '');
      const bt = String(b.values['created_at'] ?? '');
      return at < bt ? -1 : at > bt ? 1 : a.id - b.id;
    });
    return rows.map((row) => this.threadRow(row, entityFields?.[row.type] ?? []));
  }

  /** One thread row, in the flat shape the endpoint answers. */
  private threadRow(row: Row, widen: string[]): ThreadRow {
    const isReply = row.type === 'Reply';
    const author = this.threadAuthor(row.values[isReply ? 'user' : 'created_by'] as EntityRef | null, isReply);
    const fields: Record<string, unknown> = { type: row.type, id: row.id, created_at: row.values['created_at'] ?? null };
    // `content` is absent from an Attachment row: only its id, type, timestamp and author come back.
    if (row.type !== 'Attachment') fields['content'] = row.values['content'] ?? null;
    fields[isReply ? 'user' : 'created_by'] = author;
    // `entity_fields[Reply]` is accepted and widens nothing.
    if (!isReply) {
      for (const name of widen) if (SPECS[row.type]?.[name]) fields[name] = row.values[name] ?? null;
    }
    return {
      type: row.type,
      id: row.id,
      createdAt: (row.values['created_at'] as string | null | undefined) ?? null,
      content: row.type === 'Attachment' ? null : ((row.values['content'] as string | null | undefined) ?? null),
      author,
      fields,
    };
  }

  /** `{id, name, type}`, plus a presigned `image` when the row is a Reply. */
  private threadAuthor(value: EntityRef | null | undefined, withImage: boolean): ThreadAuthor | null {
    if (!value) return null;
    const row = this.fixtures.index.get(`${value.type}:${value.id}`);
    const author: ThreadAuthor = { type: value.type, id: value.id, name: row ? displayNameOf(row.values, `#${value.id}`) : `#${value.id}` };
    if (withImage) author.image = (row?.values['image'] as string | null | undefined) ?? null;
    return author;
  }

  /**
   * What changed, newest first. `meta` is read off the row because it takes no
   * filter and no sort, and the cut is made on `project`, `entity`, `event_type`,
   * `attribute_name` and `created_at` (025_event_log).
   */
  async eventLog(options: EventLogOptions = {}): Promise<EventLogResult> {
    const size = options.page?.size ?? 50;
    const res = await this.search('EventLogEntry', {
      filters: eventLogFilters(options),
      fields: [...EVENT_LOG_FIELDS],
      sort: '-id',
      page: { size, number: options.page?.number ?? 1 },
    });
    return { data: res.data.map(normalizeEventLogEntry), hasMore: res.hasMore };
  }

  /**
   * Everything one person follows, unpaged. `entity` takes the schema name or the
   * snake_case plural, and both cuts are made server-side
   * (get_entity_human_users_id_following).
   */
  async following(userId: number, options: FollowingOptions = {}): Promise<EntityRef[]> {
    await this.gate();
    // An ApiUser id under this path answers the same 404: a script cannot ask what it follows.
    if (!this.fixtures.index.get(`HumanUser:${userId}`)) {
      throw new SgApiError(404, null, `Couldn't find HumanUser with id="${userId}"`);
    }
    if (options.projectId !== undefined && !this.fixtures.index.get(`Project:${options.projectId}`)) {
      throw new SgApiError(404, null, `Couldn't find Project with id="${options.projectId}"`);
    }
    let wanted: string | null = null;
    if (options.entity !== undefined) {
      wanted = entityTypeNamed(options.entity);
      if (wanted === null) throw new SgApiError(400, { entity: ['entity is not valid'] }, 'entity is not valid');
    }
    const rows = this.fixtures.follows.get(userId) ?? [];
    return rows
      .filter((r) => {
        if (wanted !== null && r.type !== wanted) return false;
        if (options.projectId === undefined) return true;
        const row = this.fixtures.index.get(`${r.type}:${r.id}`);
        return (row?.values['project'] as EntityRef | undefined)?.id === options.projectId;
      })
      .map((r) => ({ type: r.type, id: r.id }));
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
    const now = this.clock();
    // A dotted path that reaches several rows matches if any of them does.
    if (values.length > 1) return values.some((v) => evaluate(dataType, operator, v ?? null, expected, now));
    return evaluate(dataType, operator, values.length === 0 ? null : (values[0] ?? null), expected, now);
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

/** A type named as a schema name or as its snake_case plural, or null for neither. */
function entityTypeNamed(name: string): string | null {
  if (SPECS[name]) return name;
  const wanted = name.toLowerCase();
  return Object.keys(SPECS).find((type) => type.toLowerCase() === wanted || pluralPath(type) === wanted) ?? null;
}

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

/* -------------------------------------------------------------------------- */
/* the clock, and the date operators read off it                              */
/* -------------------------------------------------------------------------- */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function toClock(now: MockClientOptions['now']): () => number {
  if (typeof now === 'function') return now;
  if (typeof now === 'number') return () => now;
  if (typeof now === 'string') {
    const fixed = Date.parse(now);
    if (Number.isNaN(fixed)) throw new TypeError(`MockClient: 'now' is not a date: ${now}`);
    return () => fixed;
  }
  return () => Date.now();
}

const RELATIVE_OPERATORS: ReadonlySet<Operator> = new Set(['in_last', 'not_in_last', 'in_next', 'not_in_next']);
const CALENDAR_OPERATORS: ReadonlySet<Operator> = new Set([
  'in_calendar_day', 'in_calendar_week', 'in_calendar_month', 'in_calendar_year',
]);

/** A value list the way the API prints one back in an error. */
function printList(values: readonly unknown[]): string {
  return `[${values.map((v) => JSON.stringify(v)).join(', ')}]`;
}

/** `[count, UNIT]`, with the three 400s the API answers for a malformed one (field_types/date). */
function relativeValue(operator: Operator, expected: unknown): [number, TimeUnit] {
  const parts = Array.isArray(expected) ? expected : [expected];
  if (parts.length !== 2) {
    throw new SgApiError(400, null, `API read() '${operator}' 'relation' expects a 2-element array: ${printList(parts)}`);
  }
  const [count, unit] = parts as [unknown, unknown];
  if (!TIME_UNITS.includes(unit as TimeUnit)) {
    throw new SgApiError(
      400,
      null,
      `API read() '${operator}' 'relation' doesn't support the '${String(unit)}' time unit: ${printList(parts)}  Valid time units: ${printList(TIME_UNITS)}`,
    );
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) {
    // The API's own wording, missing word included.
    throw new SgApiError(400, null, `API read() '${operator}' 'relation' expects at a positive Integer time unit`);
  }
  return [count, unit as TimeUnit];
}

/** Shift a UTC instant by whole months, clamping a day the target month does not have. */
function shiftMonths(t: number, months: number): number {
  const d = new Date(t);
  const day = d.getUTCDate();
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0)).getUTCDate();
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + months,
    Math.min(day, last),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  );
}

/** The window `[count, UNIT]` names: back to `now`, or forward from it. */
function relativeWindow(now: number, count: number, unit: TimeUnit, forward: boolean): [number, number] {
  const sign = forward ? 1 : -1;
  const edge =
    unit === 'HOUR' ? now + sign * count * HOUR_MS
    : unit === 'DAY' ? now + sign * count * DAY_MS
    : unit === 'WEEK' ? now + sign * count * 7 * DAY_MS
    : unit === 'MONTH' ? shiftMonths(now, sign * count)
    : shiftMonths(now, sign * count * 12);
  return forward ? [now, edge] : [edge, now];
}

/**
 * The UTC calendar bucket `offset` from the one holding `now`, inclusive at both ends.
 * A week runs Monday to Sunday: the corpus pins the buckets to UTC but not the first day.
 */
function calendarWindow(now: number, operator: Operator, offset: number): [number, number] {
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  if (operator === 'in_calendar_year') return [Date.UTC(year + offset, 0, 1), Date.UTC(year + offset + 1, 0, 1) - 1];
  if (operator === 'in_calendar_month') return [Date.UTC(year, month + offset, 1), Date.UTC(year, month + offset + 1, 1) - 1];
  const midnight = Date.UTC(year, month, d.getUTCDate());
  if (operator === 'in_calendar_day') {
    const start = midnight + offset * DAY_MS;
    return [start, start + DAY_MS - 1];
  }
  const start = midnight - ((d.getUTCDay() + 6) % 7) * DAY_MS + offset * 7 * DAY_MS;
  return [start, start + 7 * DAY_MS - 1];
}

/**
 * The inclusive span a stored value covers. A `date` has no time of day and stands for its whole
 * UTC day, which is why a window shorter than a day still matches today (field_types/date).
 */
function span(dataType: string, value: unknown): [number, number] | null {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return dataType === 'date' ? [t, t + DAY_MS - 1] : [t, t];
}

function within(dataType: string, actual: unknown, window: [number, number]): boolean {
  const covered = span(dataType, actual);
  return covered !== null && covered[0] <= window[1] && covered[1] >= window[0];
}

/** A relative or calendar date operator, resolved against the clock. */
function matchTemporal(dataType: string, operator: Operator, actual: unknown, expected: unknown, now: number): boolean {
  if (RELATIVE_OPERATORS.has(operator)) {
    // Validated before the row is read: a malformed value 400s whatever the rows hold.
    const [count, unit] = relativeValue(operator, expected);
    const negating = NEGATING_OPERATORS.has(operator);
    // `not_in_last` and `not_in_next` match a row with no date at all (field_types/date).
    if (isNullish(actual)) return negating;
    const forward = operator === 'in_next' || operator === 'not_in_next';
    const hit = within(dataType, actual, relativeWindow(now, count, unit, forward));
    return negating ? !hit : hit;
  }
  // A signed offset from the current bucket, 0 being this one, taken bare or as a one-element array.
  const offset = Number(Array.isArray(expected) ? expected[0] : expected);
  // A non-integer offset is not measured: nothing matches, rather than a 400 the API may not answer.
  if (!Number.isInteger(offset)) return false;
  return within(dataType, actual, calendarWindow(now, operator, offset));
}

function namesOf(actual: unknown): string[] {
  return refsOf(actual)
    .map((r) => (typeof r.name === 'string' ? r.name : ''))
    .filter(Boolean);
}

function evaluate(dataType: string, operator: Operator, actual: unknown, expected: unknown, now: number): boolean {
  if (RELATIVE_OPERATORS.has(operator) || CALENDAR_OPERATORS.has(operator)) {
    return matchTemporal(dataType, operator, actual, expected, now);
  }
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
      // The date operators are handled above; every other operator in the vocabulary has a case.
      return false;
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
