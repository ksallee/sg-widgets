/**
 * Stock status icons.
 *
 * A status with an `image_map` icon names a CSS class such as `icon_apr`. The image
 * behind it is one sprite the web app serves unauthenticated at
 * `/images/sg_icon_image_map.png`, positioned by rules in
 * `/dist/production/stylesheets/login.css` (probe 010). Neither is in the REST API.
 * The offsets below are those rules, read once; the data URLs are the sprite cells of
 * the statuses a fresh site ships with, so a badge renders them with no site access.
 *
 * A shipped status is a row with no `created_by`. `system` marks a subset of them
 * (act, dis, ip, na, cfrm, pndng) and no schema flag marks the set; a site may
 * have retired some of the shipped rows (probe 061).
 */

export interface SpriteCell {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Path of the stock sprite on any site. The stylesheet appends a cache-busting query; the bare path answers 200. */
export const STOCK_SPRITE_PATH = '/images/sg_icon_image_map.png';

export interface NativeStatus {
  code: string;
  name: string;
  /** `image_map_key` of the shipped icon. `act` has an html icon and no key. */
  imageMapKey: string | null;
  /** Locked by the system: cannot be deleted. */
  system: boolean;
}

/** Shipped statuses the probed site keeps live, in id order (probe 061). */
export const NATIVE_STATUSES: readonly NativeStatus[] = [
  { code: 'act', name: 'Active', imageMapKey: null, system: true },
  { code: 'apr', name: 'Approved', imageMapKey: 'icon_apr', system: false },
  { code: 'clsd', name: 'Closed', imageMapKey: 'icon_fin', system: false },
  { code: 'cmpt', name: 'Complete', imageMapKey: 'icon_cmpt', system: false },
  { code: 'dis', name: 'Disabled', imageMapKey: 'icon_na', system: true },
  { code: 'fin', name: 'Final', imageMapKey: 'icon_fin', system: false },
  { code: 'hld', name: 'On Hold', imageMapKey: 'icon_hld', system: false },
  { code: 'ip', name: 'In Progress', imageMapKey: 'icon_ip', system: true },
  { code: 'na', name: 'N/A', imageMapKey: 'icon_na', system: true },
  { code: 'omt', name: 'Omit', imageMapKey: 'icon_omt', system: false },
  { code: 'opn', name: 'Open', imageMapKey: 'icon_rdy', system: false },
  { code: 'res', name: 'Resolved', imageMapKey: 'icon_fin', system: false },
  { code: 'rev', name: 'Pending Review', imageMapKey: 'icon_rev', system: false },
  { code: 'wtg', name: 'Waiting to Start', imageMapKey: 'icon_wtg', system: false },
  { code: 'vwd', name: 'Viewed', imageMapKey: 'icon_fin', system: false },
  { code: 'recd', name: 'Received', imageMapKey: 'icon_recd', system: false },
  { code: 'dlvr', name: 'Delivered', imageMapKey: 'icon_dlvr', system: false },
  { code: 'cfrm', name: 'Confirmed', imageMapKey: 'icon_thumb_up', system: true },
  { code: 'pndng', name: 'Pending', imageMapKey: 'icon_voice_command', system: true },
] as const;

/** Sprite cell per `image_map_key`, from the site stylesheet. Covers every stock icon a status may use. */
export const STOCK_ICON_CELLS: Readonly<Record<string, SpriteCell>> = {
  icon_activity: { x: 240, y: 107, w: 16, h: 15 },
  icon_airplane: { x: 314, y: 538, w: 16, h: 16 },
  icon_alert: { x: 330, y: 538, w: 16, h: 16 },
  icon_annotation: { x: 296, y: 748, w: 31, h: 30 },
  icon_announcement: { x: 346, y: 538, w: 16, h: 16 },
  icon_apr: { x: 89, y: 11, w: 12, h: 11 },
  icon_arrow_down: { x: 126, y: 79, w: 14, h: 14 },
  icon_arrow_down_dark: { x: 362, y: 538, w: 16, h: 16 },
  icon_arrow_head_right: { x: 54, y: 619, w: 12, h: 18 },
  icon_arrow_left: { x: 378, y: 538, w: 16, h: 16 },
  icon_arrow_right: { x: 70, y: 65, w: 15, h: 14 },
  icon_arrow_right2: { x: 0, y: 554, w: 16, h: 16 },
  icon_arrow_thin_down: { x: 36, y: 0, w: 5, h: 6 },
  icon_arrow_thin_left: { x: 176, y: 602, w: 19, h: 17 },
  icon_arrow_thin_up: { x: 41, y: 0, w: 5, h: 6 },
  icon_arrow_up: { x: 140, y: 79, w: 14, h: 14 },
  icon_arrow_up_dark: { x: 16, y: 554, w: 16, h: 16 },
  icon_asg: { x: 32, y: 554, w: 16, h: 16 },
  icon_attachment_white: { x: 34, y: 638, w: 18, h: 19 },
  icon_auction: { x: 48, y: 554, w: 16, h: 16 },
  icon_award: { x: 64, y: 554, w: 16, h: 16 },
  icon_back: { x: 154, y: 79, w: 15, h: 14 },
  icon_bell: { x: 80, y: 554, w: 16, h: 16 },
  icon_bicycle: { x: 96, y: 554, w: 16, h: 16 },
  icon_blocked: { x: 169, y: 79, w: 14, h: 14 },
  icon_blue: { x: 183, y: 79, w: 14, h: 14 },
  icon_bluered: { x: 197, y: 79, w: 14, h: 14 },
  icon_bluered_check: { x: 211, y: 79, w: 14, h: 14 },
  icon_box: { x: 225, y: 79, w: 14, h: 14 },
  icon_browser_overlay_player: { x: 304, y: 506, w: 16, h: 16 },
  icon_bug: { x: 112, y: 554, w: 16, h: 16 },
  icon_c: { x: 239, y: 79, w: 14, h: 14 },
  icon_c_black: { x: 70, y: 23, w: 12, h: 12 },
  icon_calculator: { x: 128, y: 554, w: 16, h: 16 },
  icon_calendar: { x: 144, y: 554, w: 16, h: 16 },
  icon_calendar_edit: { x: 83, y: 0, w: 7, h: 8 },
  icon_calendar_view: { x: 274, y: 11, w: 13, h: 12 },
  icon_car: { x: 160, y: 554, w: 16, h: 16 },
  icon_car_dark: { x: 176, y: 554, w: 16, h: 16 },
  icon_card_view: { x: 207, y: 0, w: 13, h: 9 },
  icon_carnation: { x: 253, y: 79, w: 14, h: 14 },
  icon_cbb: { x: 267, y: 79, w: 14, h: 14 },
  icon_chain_link: { x: 256, y: 107, w: 15, h: 15 },
  icon_check: { x: 192, y: 554, w: 16, h: 16 },
  icon_check_blue: { x: 101, y: 11, w: 12, h: 11 },
  icon_check_orange: { x: 113, y: 11, w: 12, h: 11 },
  icon_checkmark_small_white: { x: 287, y: 11, w: 12, h: 12 },
  icon_checkmark_thin_white: { x: 90, y: 0, w: 13, h: 8 },
  icon_chili: { x: 309, y: 79, w: 14, h: 14 },
  icon_chili2: { x: 281, y: 79, w: 14, h: 14 },
  icon_chili3: { x: 295, y: 79, w: 14, h: 14 },
  icon_client_final: { x: 70, y: 122, w: 18, h: 15 },
  icon_clock: { x: 323, y: 79, w: 14, h: 14 },
  icon_clock_dark: { x: 208, y: 554, w: 16, h: 16 },
  icon_cmpt: { x: 337, y: 79, w: 14, h: 14 },
  icon_coffee_cup: { x: 224, y: 554, w: 16, h: 16 },
  icon_coffee_mug: { x: 240, y: 554, w: 16, h: 16 },
  icon_comment: { x: 195, y: 602, w: 17, h: 17 },
  icon_construction: { x: 256, y: 554, w: 16, h: 16 },
  icon_construction_hat: { x: 272, y: 554, w: 16, h: 16 },
  icon_cool: { x: 288, y: 554, w: 16, h: 16 },
  icon_cowbell: { x: 304, y: 554, w: 16, h: 16 },
  icon_cursor: { x: 320, y: 554, w: 16, h: 16 },
  icon_cut: { x: 336, y: 554, w: 16, h: 16 },
  icon_dailies: { x: 351, y: 79, w: 14, h: 14 },
  icon_dashboard: { x: 352, y: 554, w: 16, h: 16 },
  icon_delete: { x: 368, y: 554, w: 16, h: 16 },
  icon_delivery_truck: { x: 384, y: 554, w: 16, h: 16 },
  icon_design_page: { x: 320, y: 506, w: 16, h: 16 },
  icon_dlvr: { x: 88, y: 122, w: 17, h: 15 },
  icon_down_facing_arrow_circle: { x: 225, y: 721, w: 27, h: 27 },
  icon_download: { x: 212, y: 602, w: 17, h: 17 },
  icon_drag_drop_handle: { x: 386, y: 0, w: 11, h: 11 },
  icon_e: { x: 365, y: 79, w: 14, h: 14 },
  icon_edit: { x: 311, y: 11, w: 12, h: 12 },
  icon_edit_disabled: { x: 335, y: 11, w: 12, h: 12 },
  icon_edit_selected: { x: 170, y: 23, w: 14, h: 13 },
  icon_email: { x: 220, y: 0, w: 13, h: 9 },
  icon_email2: { x: 0, y: 570, w: 16, h: 16 },
  icon_email_open: { x: 16, y: 570, w: 16, h: 16 },
  icon_email_password: { x: 0, y: 721, w: 23, h: 23 },
  icon_exchange: { x: 32, y: 570, w: 16, h: 16 },
  icon_expand: { x: 48, y: 570, w: 16, h: 16 },
  icon_export_excel: { x: 336, y: 506, w: 16, h: 16 },
  icon_eye: { x: 64, y: 570, w: 16, h: 16 },
  icon_f: { x: 379, y: 79, w: 14, h: 14 },
  icon_fan: { x: 80, y: 570, w: 16, h: 16 },
  icon_favorite: { x: 96, y: 570, w: 16, h: 16 },
  icon_filter: { x: 352, y: 506, w: 15, h: 16 },
  icon_filter_active: { x: 367, y: 506, w: 15, h: 16 },
  icon_filter_menu: { x: 196, y: 699, w: 21, h: 22 },
  icon_fin: { x: 128, y: 0, w: 7, h: 8 },
  icon_financial: { x: 112, y: 570, w: 16, h: 16 },
  icon_first_aid_box: { x: 128, y: 570, w: 16, h: 16 },
  icon_flag: { x: 144, y: 570, w: 16, h: 16 },
  icon_flag_red: { x: 0, y: 93, w: 14, h: 14 },
  icon_flash: { x: 160, y: 570, w: 16, h: 16 },
  icon_follow_link_large: { x: 100, y: 657, w: 20, h: 20 },
  icon_formatting: { x: 85, y: 65, w: 15, h: 14 },
  icon_gear: { x: 322, y: 0, w: 10, h: 10 },
  icon_gift: { x: 176, y: 570, w: 16, h: 16 },
  icon_gift_card: { x: 192, y: 570, w: 16, h: 16 },
  icon_go_to_bottom: { x: 208, y: 570, w: 16, h: 16 },
  icon_go_to_top: { x: 224, y: 570, w: 16, h: 16 },
  icon_green_circle_dot: { x: 240, y: 570, w: 16, h: 16 },
  icon_green_d: { x: 14, y: 93, w: 14, h: 14 },
  icon_grid_view: { x: 53, y: 0, w: 13, h: 7 },
  icon_gym: { x: 256, y: 570, w: 16, h: 16 },
  icon_hammer: { x: 272, y: 570, w: 16, h: 16 },
  icon_hand: { x: 288, y: 570, w: 16, h: 16 },
  icon_hand_pointer: { x: 304, y: 570, w: 16, h: 16 },
  icon_help: { x: 320, y: 570, w: 16, h: 16 },
  icon_help_balloon_sm: { x: 66, y: 619, w: 18, h: 18 },
  icon_help_round: { x: 100, y: 65, w: 14, h: 14 },
  icon_hld: { x: 66, y: 0, w: 5, h: 7 },
  icon_hot: { x: 336, y: 570, w: 16, h: 16 },
  icon_hourglass: { x: 352, y: 570, w: 16, h: 16 },
  icon_if: { x: 28, y: 93, w: 14, h: 14 },
  icon_import_csv: { x: 382, y: 506, w: 16, h: 16 },
  icon_inbox_clear: { x: 114, y: 65, w: 14, h: 14 },
  icon_inbox_gear: { x: 0, y: 522, w: 16, h: 16 },
  icon_inbox_refresh: { x: 217, y: 699, w: 20, h: 22 },
  icon_inbox_search: { x: 271, y: 107, w: 15, h: 15 },
  icon_info_dark: { x: 347, y: 11, w: 12, h: 12 },
  icon_invite_people: { x: 84, y: 619, w: 14, h: 18 },
  icon_ip: { x: 332, y: 0, w: 10, h: 10 },
  icon_ip25: { x: 42, y: 93, w: 28, h: 14 },
  icon_ip50: { x: 70, y: 93, w: 28, h: 14 },
  icon_ip75: { x: 98, y: 93, w: 28, h: 14 },
  icon_jira_bridge: { x: 128, y: 65, w: 14, h: 14 },
  icon_jump: { x: 32, y: 522, w: 16, h: 16 },
  icon_key: { x: 368, y: 570, w: 16, h: 16 },
  icon_kick: { x: 126, y: 93, w: 14, h: 14 },
  icon_light_bulb: { x: 384, y: 570, w: 16, h: 16 },
  icon_linked_file: { x: 142, y: 65, w: 14, h: 14 },
  icon_lock: { x: 156, y: 65, w: 14, h: 14 },
  icon_lock2: { x: 0, y: 586, w: 16, h: 16 },
  icon_lock_small: { x: 184, y: 23, w: 11, h: 13 },
  icon_login: { x: 16, y: 586, w: 16, h: 16 },
  icon_logout: { x: 32, y: 586, w: 16, h: 16 },
  icon_manage_shares: { x: 170, y: 65, w: 16, h: 14 },
  icon_martini_glass: { x: 48, y: 586, w: 16, h: 16 },
  icon_media: { x: 252, y: 721, w: 27, h: 27 },
  icon_media_active: { x: 279, y: 721, w: 27, h: 27 },
  icon_media_playlist: { x: 110, y: 721, w: 19, h: 24 },
  icon_menu_arrow_down: { x: 233, y: 0, w: 9, h: 9 },
  icon_menu_arrow_up: { x: 242, y: 0, w: 9, h: 9 },
  icon_microphone: { x: 64, y: 586, w: 16, h: 16 },
  icon_mode_cal_on: { x: 98, y: 619, w: 25, h: 18 },
  icon_mode_link_off: { x: 123, y: 619, w: 25, h: 18 },
  icon_mode_link_on: { x: 148, y: 619, w: 25, h: 18 },
  icon_mode_note_off: { x: 173, y: 619, w: 25, h: 18 },
  icon_mode_note_on: { x: 198, y: 619, w: 25, h: 18 },
  icon_music: { x: 80, y: 586, w: 16, h: 16 },
  icon_mute: { x: 359, y: 11, w: 15, h: 12 },
  icon_mute_active: { x: 374, y: 11, w: 15, h: 12 },
  icon_my_tasks_new_task: { x: 282, y: 0, w: 10, h: 10 },
  icon_na: { x: 46, y: 0, w: 7, h: 6 },
  icon_nested_grouping: { x: 195, y: 23, w: 12, h: 13 },
  icon_new_page: { x: 48, y: 522, w: 19, h: 16 },
  icon_notes: { x: 140, y: 93, w: 14, h: 14 },
  icon_office_chair: { x: 96, y: 586, w: 16, h: 16 },
  icon_omt: { x: 154, y: 93, w: 14, h: 14 },
  icon_package_box: { x: 112, y: 586, w: 16, h: 16 },
  icon_padlock: { x: 306, y: 107, w: 20, h: 15 },
  icon_padlock_large: { x: 23, y: 721, w: 18, h: 23 },
  icon_padlock_unlocked: { x: 346, y: 107, w: 20, h: 15 },
  icon_page_settings: { x: 186, y: 65, w: 19, h: 14 },
  icon_page_settings_dirty: { x: 205, y: 65, w: 19, h: 14 },
  icon_paperclip: { x: 237, y: 65, w: 13, h: 14 },
  icon_phone: { x: 128, y: 586, w: 16, h: 16 },
  icon_player_close_x: { x: 52, y: 638, w: 13, h: 19 },
  icon_player_pan: { x: 357, y: 748, w: 30, h: 30 },
  icon_plus: { x: 292, y: 0, w: 10, h: 10 },
  icon_plus_dark: { x: 0, y: 23, w: 12, h: 12 },
  icon_plus_white: { x: 111, y: 0, w: 8, h: 8 },
  icon_preferences: { x: 264, y: 65, w: 14, h: 14 },
  icon_purple_circle_line: { x: 168, y: 93, w: 14, h: 14 },
  icon_push_pinned_task: { x: 366, y: 107, w: 19, h: 15 },
  icon_puzzle: { x: 144, y: 586, w: 16, h: 16 },
  icon_question: { x: 182, y: 93, w: 14, h: 14 },
  icon_r: { x: 105, y: 122, w: 20, h: 15 },
  icon_rdy: { x: 342, y: 0, w: 10, h: 10 },
  icon_recd: { x: 196, y: 93, w: 14, h: 14 },
  icon_redo: { x: 210, y: 93, w: 14, h: 14 },
  icon_redo_again: { x: 160, y: 586, w: 16, h: 16 },
  icon_reprocess: { x: 125, y: 122, w: 14, h: 15 },
  icon_restrict: { x: 176, y: 586, w: 16, h: 16 },
  icon_rev: { x: 314, y: 23, w: 12, h: 13 },
  icon_revert: { x: 293, y: 65, w: 15, h: 14 },
  icon_right_facing_arrow_circle: { x: 306, y: 721, w: 27, h: 27 },
  icon_rocket: { x: 192, y: 586, w: 16, h: 16 },
  icon_satellite: { x: 208, y: 586, w: 16, h: 16 },
  icon_save: { x: 308, y: 65, w: 15, h: 14 },
  icon_search: { x: 220, y: 678, w: 21, h: 21 },
  icon_search_active: { x: 241, y: 678, w: 21, h: 21 },
  icon_search_active_open: { x: 262, y: 678, w: 21, h: 21 },
  icon_search_open: { x: 283, y: 678, w: 21, h: 21 },
  icon_security: { x: 224, y: 586, w: 16, h: 16 },
  icon_sent: { x: 238, y: 93, w: 14, h: 14 },
  icon_settings: { x: 247, y: 602, w: 18, h: 17 },
  icon_settings_dense: { x: 210, y: 522, w: 16, h: 16 },
  icon_share: { x: 89, y: 522, w: 13, h: 16 },
  icon_share_large_blue: { x: 41, y: 721, w: 18, h: 23 },
  icon_share_large_white: { x: 59, y: 721, w: 18, h: 23 },
  icon_share_small: { x: 207, y: 23, w: 11, h: 13 },
  icon_share_small_dark: { x: 323, y: 65, w: 14, h: 14 },
  icon_shovel: { x: 240, y: 586, w: 16, h: 16 },
  icon_shuffle: { x: 256, y: 586, w: 16, h: 16 },
  icon_small_white_play: { x: 304, y: 678, w: 22, h: 21 },
  icon_sofa_chair: { x: 272, y: 586, w: 16, h: 16 },
  icon_sport: { x: 288, y: 586, w: 16, h: 16 },
  icon_square_empty: { x: 82, y: 23, w: 12, h: 12 },
  icon_square_purple_100: { x: 106, y: 23, w: 12, h: 12 },
  icon_square_purple_50: { x: 94, y: 23, w: 12, h: 12 },
  icon_star: { x: 304, y: 586, w: 16, h: 16 },
  icon_stop: { x: 320, y: 586, w: 16, h: 16 },
  icon_stopped: { x: 252, y: 93, w: 14, h: 14 },
  icon_t: { x: 266, y: 93, w: 14, h: 14 },
  icon_tab_two_pane: { x: 0, y: 11, w: 13, h: 11 },
  icon_tab_url: { x: 337, y: 65, w: 14, h: 14 },
  icon_techfix: { x: 280, y: 93, w: 14, h: 14 },
  icon_template: { x: 229, y: 23, w: 13, h: 13 },
  icon_thumb_column_header: { x: 13, y: 11, w: 15, h: 11 },
  icon_thumb_down: { x: 336, y: 586, w: 16, h: 16 },
  icon_thumb_up: { x: 352, y: 586, w: 16, h: 16 },
  icon_thumbnail_view: { x: 251, y: 0, w: 13, h: 9 },
  icon_thumbs_down: { x: 294, y: 93, w: 14, h: 14 },
  icon_thumbs_up: { x: 308, y: 93, w: 14, h: 14 },
  icon_to: { x: 322, y: 93, w: 14, h: 14 },
  icon_today_dense: { x: 162, y: 522, w: 16, h: 16 },
  icon_tool_box: { x: 368, y: 586, w: 16, h: 16 },
  icon_tooltip: { x: 365, y: 65, w: 14, h: 14 },
  icon_trash: { x: 384, y: 586, w: 16, h: 16 },
  icon_trash_crs: { x: 102, y: 522, w: 12, h: 16 },
  icon_triangle_blue_100: { x: 137, y: 11, w: 12, h: 11 },
  icon_triangle_blue_50: { x: 125, y: 11, w: 12, h: 11 },
  icon_triangle_grey: { x: 149, y: 11, w: 12, h: 11 },
  icon_trophy: { x: 0, y: 602, w: 16, h: 16 },
  icon_umbella: { x: 16, y: 602, w: 16, h: 16 },
  icon_undo: { x: 32, y: 602, w: 16, h: 16 },
  icon_unlock: { x: 48, y: 602, w: 16, h: 16 },
  icon_unpin_task: { x: 379, y: 65, w: 15, h: 14 },
  icon_uploaded_file: { x: 385, y: 107, w: 14, h: 15 },
  icon_url: { x: 114, y: 522, w: 16, h: 16 },
  icon_view_eye: { x: 28, y: 11, w: 21, h: 11 },
  icon_voice_command: { x: 64, y: 602, w: 16, h: 16 },
  icon_walk: { x: 80, y: 602, w: 16, h: 16 },
  icon_warning: { x: 130, y: 522, w: 16, h: 16 },
  icon_weather: { x: 96, y: 602, w: 16, h: 16 },
  icon_web: { x: 0, y: 79, w: 14, h: 14 },
  icon_webhooks: { x: 146, y: 522, w: 16, h: 16 },
  icon_wrap_text: { x: 49, y: 11, w: 14, h: 11 },
  icon_wrench: { x: 242, y: 23, w: 14, h: 13 },
  icon_wtg: { x: 1, y: 0, w: 4, h: 1 },
  icon_x_in_circle: { x: 178, y: 721, w: 26, h: 26 },
  icon_x_no_shadow: { x: 302, y: 0, w: 10, h: 10 },
  icon_x_thin_white: { x: 119, y: 0, w: 9, h: 8 },
  icon_yellow_circle_line: { x: 336, y: 93, w: 14, h: 14 },
  icon_zoom: { x: 131, y: 748, w: 29, h: 28 },
  icon_zoom_in_dense: { x: 178, y: 522, w: 16, h: 16 },
  icon_zoom_out_dense: { x: 194, y: 522, w: 16, h: 16 },
  icon_zoom_task_dependencies: { x: 14, y: 79, w: 14, h: 14 },
};

/** Sprite cells of the shipped statuses, as PNG data URLs. */
export const NATIVE_ICON_DATA_URLS: Readonly<Record<string, string>> = {
  icon_apr:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAALCAYAAABLcGxfAAAACXBIWXMAAAsSAAALEgHS3X78AAAAy0lEQVQokWNgQAd9DAYMfQwOYBoK1NTUBNTU1M6rqaklICsEKbrP0MfwHwmD+A5qamrr1dTU/iM0QBT/Z5jK8J/hFMN/hntQeirDfwlfCZBCEO5HNv0+WPEnhv9Mb5j+M/xkAGPhCcJgxZKeku/R3Qw2Ud5P/r9stCxYMd8qPrBiWXdZmPMMUJ1zD2EiSBOIBhnAdJEJpsEBwwaQyTDFig6KEOeBxFFswOIHiVKJ/+wX2cF8sDhIHi3scYYSqnMwNWGNB0zFBGIaGQAA30eIiQoxNjkAAAAASUVORK5CYII=',
  icon_cmpt:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAACXBIWXMAAAsSAAALEgHS3X78AAAAhUlEQVQokZ2SwQ2AIAxF30iOwITcXIohYAdvnmqgiohgEJLfhtBHWygiwoxIpl6WBYtJHgZADQ5YpFD4BhUSVgSH4E8f9zaG9cGQgjaEvZLCoSxbjfakGVqgy2UvNahl+g7oM2j6Gfc/Gad7HHhV4nkTvOHXP15QH7wveExOuR7g9KzO6AAuen3DA4RHKQAAAABJRU5ErkJggg==',
  icon_dlvr:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAPCAYAAAACsSQRAAAACXBIWXMAAAsSAAALEgHS3X78AAAAYUlEQVQ4jdXSMQrAIAyF4RzNOTlrxd1oerPXoRQ6qA0EhA7/mG94hABQNPoPoloRRlgEra4hF8If0PSIB3VVhBEWgfWGEGI3kDybpHcPcJoNAfewR85TwIWUUpbAvo/dhlzGet6GGF1oigAAAABJRU5ErkJggg==',
  icon_fin:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAICAYAAAA1BOUGAAAACXBIWXMAAAsSAAALEgHS3X78AAAAdklEQVQImVWPwQnEMAwEU8KVlBJSwBrsl22wwe7gOrhSroQrIaWkBB1jokcEYtmZj7Rt90h6SdpJZy4+kiylZCTdxTvGaGMMm3OupMORV+99CV86HPkQvnDkWUp5iFor8kQeIQTLOVtrbSUd7kfxwlfS784d/gcntF+WVPM/vwAAAABJRU5ErkJggg==',
  icon_hld:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAHCAYAAADAp4fuAAAACXBIWXMAAAsSAAALEgHS3X78AAAANElEQVQImW2KyQkAQAyEUkOO/kt1mccEFvIQRIyqQgBhX/liZiIU7fd5xu5GKNpjZhCK9gew7jckKp48xAAAAABJRU5ErkJggg==',
  icon_ip:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAACXBIWXMAAAsSAAALEgHS3X78AAAAkklEQVQYlXWQwQ2DMAxF3wAcGIhDRmCUTmLUqkckJqgYod2EG1dGcPVTgyxEI/3o5/sltoK7I2EUjAnjHZqUHfWABgzH2BK4RTZUBqOPYMZoU4c2MtV64vaSoRO8VCY/f6VjLG3Ns/HyKpdSbQfXah5/9Ou4CrzFwbknQH7PxcQcYwrPGtFKQ3cYn/g/Sb6rEPAF/cmo6ERE7E4AAAAASUVORK5CYII=',
  icon_na:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAGCAYAAAAPDoR2AAAACXBIWXMAAAsSAAALEgHS3X78AAAARUlEQVQImWOYMGFCwoQJE/5PmDDhPAMDA8OECRP6ofz5ID5IYD5UYD1M4YQJEwRgkgJQAZDE+wkTJhiAJYiRxG4sPgcBABssUGdLOhEmAAAAAElFTkSuQmCC',
  icon_omt:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAACXBIWXMAAAsSAAALEgHS3X78AAABF0lEQVQokZ2SvWqEQBSFjyLptrHKIyypLIKF3YLvIMy+hK0EqzSCVRrBXiSltV3eIZWPICzYCiE3nGFGxuwmxQ5cYa7n4/6cgYjgnoD+7M8BwAlADkABOP4W3ALPAC78h30MAB7/Al+tMEkSyfNclFIShuG3yc8WdsFnAF8AtKgoCrFnnmdJ09StvAPfec+yTIIg0KKqqnawU/noghOT0zRJ3/fi+76Gm6bZYLZtQOWCC5PLsmhR27Za5HmedF2nc5zZgLkLfjA5juNWoa5rLWTrwzDohRnw5IIvTEZRJOu6bnBZlhtsIFp1cMEHAJ8WZmW2zZnjOHb9pM9XPj5Z+EbQqrf/Xg4rs23OzIVx27SKPl8/uXviB53TVY1DanBbAAAAAElFTkSuQmCC',
  icon_rdy:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAACXBIWXMAAAsSAAALEgHS3X78AAAAWUlEQVQYlZWQQQ0AMAgDJwEL52QSJmnOkDQJW5rw4MGDkfQBLRQYIwVgwAxY5rJoAwe4gaNaJRLpwAp41Ha2U7cXLh6cKdE+6lyFUJPFzS9hz7p9zNd7Og9/+vk5mTfYZ0sAAAAASUVORK5CYII=',
  icon_recd:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAACXBIWXMAAAsSAAALEgHS3X78AAAAnklEQVQokWP48e8fA6n4////DAQVMaSp/2coM/5PUCNIEIYZ2uz+gwBII0yMOI1p6hCNEJo4jQxbi/4zTPUhQ2MaxDaYRjie4Q8WAvsDRQKKcQGGVIjtkFBblfqfYXUqXg3YNU71gWCIIF7AkEZVjWnkOHUKRCMcg8QuzsXUWG8B1YgeqqtS+xlWp/YzHO+GuwKO6y1AgdhPVFrFlcgBKdwke6NFToMAAAAASUVORK5CYII=',
  icon_rev:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAANCAYAAACdKY9CAAAACXBIWXMAAAsSAAALEgHS3X78AAAA1UlEQVQokX3RMUoDURDG8d8V7ITYBbWxEESSSuy9gI2VlTewsbexUPAGVmkEa88gWAghsVIUBSsFEwwxMjILm7C7Hwzv4838efNmmNc67tL3saxBa2jjB1t4xG0T8IpDDPGAUzw1ARe4wQHGOMd3KX+EpTCtbKWDCfYxw1meGwkEvBPmGs95GS28Z3KSwCW203eLF15wj91MlOMDV+lXiv428YU3/FZAs3xxTnv52ariiM+qSfUagEEVsIpRDXBct49ITBeK438x+lqdZM+x/VhmDOVffx7JTKTvAiHGAAAAAElFTkSuQmCC',
  icon_thumb_up:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsSAAALEgHS3X78AAABAklEQVQ4jZ3S0WnDMBAGYG3gETqCF1CsB2EQNkpqlDoIuVZtHJw4djxCR+gIHiEjaISOkBE8whVSBdI+BEsHHzoE//90CD2ZU39+6YcR+mH8PvXnALnOsRvIsRvAGp0L2kNH2kMHlnEuaPYtafYt3DkXVHVzqeoG7pzCpa4m/VHDo0VBVZSBKspL8a7hP1WU5EH4JyilCqRUWkp1lVLBQhrlO2nynQRPGoltbsQ2Bw+zEG8jyjJhskyApwlxvjGcb8DHev0aojTlJk05eCKIscQwlgBjyWzfpX5Pm9LYUBoDpfEXpfFs9yXIrQDjyGAcAcbR52pFQoyjCePoav+euR3SD0mvQOJx4DncAAAAAElFTkSuQmCC',
  icon_voice_command:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsSAAALEgHS3X78AAABQUlEQVQ4jY2SjXGCMBTHs4EjOIIDoEVp75AURAxN/QCDWCxCDW7gCIziCBnBERyBEV4PS09UFP93v8vdu/eR/F8QqtGGb5sbvk02fLsrIdfVoSjmjSjm+/iHQxVRzNOHDcJ1nITrGB7xHUb3bxKsQhGsQqhhf0pe+F+NnHIDfxkIfxlADdkp2fN84Xn+X7dCRQzqQLnmbNFwXCZmzpz9N3BcdnRcBnWgsqYz18zPydRhk6kDz4A+6Lh1bSCl4yP9nMAzIGJTIDbNiE1TYtOTkcSmxyJeh0CWRdhoZDerVmlZRB4OR/CA9KJAN8yb5xiGKQzDhCoGg+F5sKa9pxjru3IxxvoBYx3ucF67qmpCVbXD9fQ8pqoaVJD1+/g8XVHeWoryeuNDt9tLZLkHV2R5fpVnlZKkDpOkzq4gabdfLr78LzMlMXlwSHAoAAAAAElFTkSuQmCC',
  icon_wtg:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAABCAYAAAD5PA/NAAAACXBIWXMAAAsSAAALEgHS3X78AAAADklEQVQImWMoKqr9j4wBTW0JgUnBaSwAAAAASUVORK5CYII=',
};

const nativeByCode = new Map(NATIVE_STATUSES.map((s) => [s.code, s]));

export function isNativeStatus(code: string): boolean {
  return nativeByCode.has(code);
}

export function nativeStatus(code: string): NativeStatus | undefined {
  return nativeByCode.get(code);
}

/** How to draw a stock icon: a bundled image, the site's sprite, or nothing. */
export type StockIconSource =
  | { kind: 'data'; src: string; cell: SpriteCell }
  | { kind: 'sprite'; src: string; cell: SpriteCell }
  | { kind: 'none' };

/**
 * Resolve an `image_map_key`. Shipped icons come from the bundle. Any other stock
 * icon needs the site's sprite, so it draws only when `siteUrl` is given.
 */
export function stockIconSource(imageMapKey: string | null | undefined, siteUrl?: string): StockIconSource {
  if (!imageMapKey) return { kind: 'none' };
  const cell = STOCK_ICON_CELLS[imageMapKey];
  if (!cell) return { kind: 'none' };
  const data = NATIVE_ICON_DATA_URLS[imageMapKey];
  if (data) return { kind: 'data', src: data, cell };
  if (siteUrl) return { kind: 'sprite', src: siteUrl.replace(/\/+$/, '') + STOCK_SPRITE_PATH, cell };
  return { kind: 'none' };
}

/** Inline style for a sprite-backed icon element sized to its cell. */
export function spriteStyle(source: Extract<StockIconSource, { kind: 'sprite' }>): Record<string, string> {
  return {
    width: `${source.cell.w}px`,
    height: `${source.cell.h}px`,
    backgroundImage: `url(${source.src})`,
    backgroundPosition: `-${source.cell.x}px -${source.cell.y}px`,
    backgroundRepeat: 'no-repeat',
  };
}
