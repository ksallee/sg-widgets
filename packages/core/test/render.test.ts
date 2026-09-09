import { describe, expect, it } from 'vitest';
import { fileHref, nameColorIndex } from '../src/render.js';
import {
  COLOR_SENTINEL,
  fileNameFromUrl,
  formatDate,
  formatDateTime,
  formatDuration,
  formatFloat,
  formatPercent,
  formatTimecode,
  imageState,
  initialsOf,
  isEmptyValue,
  renderKindFor,
  urlLink,
} from '../src/render.js';

describe('renderKindFor', () => {
  it('collapses the numeric family and keeps the link families apart', () => {
    expect(renderKindFor('number')).toBe('number');
    expect(renderKindFor('float')).toBe('number');
    expect(renderKindFor('percent')).toBe('number');
    expect(renderKindFor('duration')).toBe('number');
    expect(renderKindFor('timecode')).toBe('number');
    expect(renderKindFor('entity')).toBe('entity');
    expect(renderKindFor('multi_entity')).toBe('multi_entity');
    expect(renderKindFor('tag_list')).toBe('multi_entity');
  });

  it('maps the display-only types', () => {
    expect(renderKindFor('status_list')).toBe('status');
    expect(renderKindFor('list')).toBe('list');
    expect(renderKindFor('date')).toBe('date');
    expect(renderKindFor('date_time')).toBe('datetime');
    expect(renderKindFor('checkbox')).toBe('checkbox');
    expect(renderKindFor('image')).toBe('image');
    expect(renderKindFor('url')).toBe('url');
    expect(renderKindFor('color')).toBe('color');
  });

  it('gives pivot_column the empty rendering and falls back to text', () => {
    // pivot_column reads null on every row over REST (field_types/pivot_column).
    expect(renderKindFor('pivot_column')).toBe('empty');
    expect(renderKindFor('calculated')).toBe('text');
    expect(renderKindFor('sg_not_a_type')).toBe('text');
  });
});

describe('isEmptyValue', () => {
  it('treats zero and false as values, not emptiness', () => {
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue('0')).toBe(false);
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue([])).toBe(true);
  });
});

describe('formatDuration', () => {
  it('renders whole minutes as h:mm', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(2400)).toBe('40:00');
    expect(formatDuration(-90)).toBe('-1:30');
  });

  it('renders days when the site reports hours_per_day', () => {
    // GET /preferences on the probed site: hours_per_day 8.0, duration_units "days".
    expect(formatDuration(480, { hoursPerDay: 8 })).toBe('1d');
    expect(formatDuration(720, { hoursPerDay: 8 })).toBe('1.5d');
    expect(formatDuration(0, { hoursPerDay: 8 })).toBe('0d');
  });

  it('is empty for an unset field', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(undefined)).toBe('');
  });
});

describe('formatPercent', () => {
  it('appends a sign to the stored 0-100 integer and clamps nothing', () => {
    expect(formatPercent(50)).toBe('50%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(101)).toBe('101%');
    expect(formatPercent(-1)).toBe('-1%');
    expect(formatPercent(null)).toBe('');
  });
});

describe('formatTimecode', () => {
  it('renders milliseconds as HH:MM:SS', () => {
    // group_name renderings recorded in field_types/timecode.
    expect(formatTimecode(3600000)).toBe('01:00:00');
    expect(formatTimecode(1000)).toBe('00:00:01');
    expect(formatTimecode(500)).toBe('00:00:00');
    expect(formatTimecode(86400000)).toBe('24:00:00');
    expect(formatTimecode(0)).toBe('00:00:00');
    expect(formatTimecode(-3600000)).toBe('-01:00:00');
    expect(formatTimecode(null)).toBe('');
  });

  it('does not wrap past 24 hours', () => {
    expect(formatTimecode(2147483647)).toBe('596:31:23');
  });
});

describe('formatFloat', () => {
  it('trims the quoted decimal the API returns', () => {
    expect(formatFloat('25.0')).toBe('25');
    expect(formatFloat('0.04')).toBe('0.04');
    expect(formatFloat('1.234568')).toBe('1.234568');
    expect(formatFloat('1.500')).toBe('1.5');
    expect(formatFloat('0.0')).toBe('0');
    expect(formatFloat('-1.50')).toBe('-1.5');
    expect(formatFloat(2.5)).toBe('2.5');
    expect(formatFloat(null)).toBe('');
  });

  it('rounds to a cap when asked', () => {
    expect(formatFloat('1.234568', { maxDecimals: 2 })).toBe('1.23');
    expect(formatFloat('1.999', { maxDecimals: 2 })).toBe('2');
  });

  it('returns an unparseable value untouched', () => {
    expect(formatFloat('n/a')).toBe('n/a');
  });
});

describe('formatDate', () => {
  it('formats a zoneless day without shifting it', () => {
    expect(formatDate('2026-09-02', { locale: 'en-US' })).toBe('Sep 2, 2026');
    expect(formatDate('2026-01-01', { locale: 'en-US' })).toBe('Jan 1, 2026');
  });

  it('passes anything that is not YYYY-MM-DD straight through', () => {
    expect(formatDate('2026-09-02T15:58:21Z', { locale: 'en-US' })).toBe('2026-09-02T15:58:21Z');
    expect(formatDate(null)).toBe('');
  });
});

describe('formatDateTime', () => {
  it('renders the stored UTC instant in a zone', () => {
    expect(formatDateTime('2026-09-02T15:58:21Z', { locale: 'en-US', timeZone: 'UTC' })).toBe(
      'Sep 2, 2026, 3:58 PM',
    );
    expect(formatDateTime('2026-09-02T15:58:21Z', { locale: 'en-US', timeZone: 'Europe/Paris' })).toBe(
      'Sep 2, 2026, 5:58 PM',
    );
  });

  it('crosses the day boundary in the viewer zone', () => {
    expect(formatDateTime('2026-09-02T23:30:00Z', { locale: 'en-US', timeZone: 'Australia/Sydney' })).toBe(
      'Sep 3, 2026, 9:30 AM',
    );
  });

  it('returns an unparseable value untouched', () => {
    expect(formatDateTime('never', { locale: 'en-US' })).toBe('never');
    expect(formatDateTime(null)).toBe('');
  });
});

describe('fileNameFromUrl', () => {
  it('takes the last path segment and drops the presigned query', () => {
    expect(fileNameFromUrl('https://s3-accelerate.amazonaws.com/abc/bunny.jpg?X-Amz-Signature=deadbeef')).toBe(
      'bunny.jpg',
    );
    expect(fileNameFromUrl('/files/0000/0000/0001/original/my%20take.mov')).toBe('my take.mov');
    expect(fileNameFromUrl('C:\\shows\\seq01\\plate.exr')).toBe('plate.exr');
    expect(fileNameFromUrl(null)).toBe('');
  });
});

describe('urlLink', () => {
  it('reads the upload shape', () => {
    expect(
      urlLink({
        url: 'https://s3-accelerate.amazonaws.com/abc/bunny.jpg?X-Amz-Expires=900',
        name: 'bunny.jpg',
        content_type: 'image/jpeg',
        link_type: 'upload',
        type: 'Attachment',
        id: 1430,
      }),
    ).toEqual({ href: 'https://s3-accelerate.amazonaws.com/abc/bunny.jpg?X-Amz-Expires=900', label: 'bunny.jpg' });
  });

  it('reads the local shape, which carries no url, as a file: link', () => {
    expect(
      urlLink(
        {
          link_type: 'local',
          name: 'plate.exr',
          local_path_mac: '/Volumes/shows/seq01/plate.exr',
          relative_path: 'seq01/plate.exr',
        },
        'mac',
      ),
    ).toEqual({
      href: 'file:///Volumes/shows/seq01/plate.exr',
      label: 'plate.exr',
      local: { mac: '/Volumes/shows/seq01/plate.exr', linux: null, windows: null, path: '/Volumes/shows/seq01/plate.exr' },
    });
  });

  it('reads the bare string shape', () => {
    expect(urlLink('/page/media_center')).toEqual({ href: '/page/media_center', label: 'media_center' });
  });

  it('is null when there is nothing to show', () => {
    expect(urlLink(null)).toBeNull();
    expect(urlLink({})).toBeNull();
  });
});

describe('imageState', () => {
  it('reads the transient prefix rather than truthiness', () => {
    expect(imageState(null)).toBe('none');
    expect(imageState('')).toBe('none');
    expect(imageState('https://site.shotgunstudio.com/images/status/transient/thumbnail_pending.png')).toBe('pending');
    expect(imageState('https://s3-accelerate.amazonaws.com/deadbeef/image.jpg?X-Amz-Expires=900')).toBe('ready');
  });
});

describe('initialsOf', () => {
  it('takes the first and last word', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('Anna van der Meer')).toBe('AM');
    expect(initialsOf('Madonna')).toBe('M');
    expect(initialsOf('j.doe')).toBe('JD');
    expect(initialsOf('  spaced   out  ')).toBe('SO');
    expect(initialsOf('')).toBe('');
    expect(initialsOf(null)).toBe('');
  });
});

describe('COLOR_SENTINEL', () => {
  it('names the token Task.color holds instead of a colour', () => {
    expect(COLOR_SENTINEL).toBe('pipeline_step');
  });
});

describe('local file links', () => {
  it('resolves the path for the platform and opens it through file:', () => {
    const value = { link_type: 'local', name: 'plate.exr', local_path_mac: '/Volumes/shows/plate.exr', local_path_windows: 'P:\\shows\\plate.exr', local_path_linux: '/mnt/shows/plate.exr' };
    expect(urlLink(value, 'mac')?.href).toBe('file:///Volumes/shows/plate.exr');
    expect(urlLink(value, 'windows')?.href).toBe('file:///P%3A/shows/plate.exr');
    expect(urlLink(value, 'linux')?.local?.path).toBe('/mnt/shows/plate.exr');
    expect(urlLink({ link_type: 'local', name: 'x', local_path_mac: '/a b/x' }, 'windows')?.href).toBe('file:///a%20b/x');
    expect(fileHref('/a/b c')).toBe('file:///a/b%20c');
  });
});

describe('formatFloat decimals', () => {
  it('fixes the precision and keeps zeros', () => {
    expect(formatFloat('1.777778', { decimals: 2 })).toBe('1.78');
    expect(formatFloat('25.0', { decimals: 3 })).toBe('25.000');
    expect(formatFloat('25.0')).toBe('25');
  });
});

describe('nameColorIndex', () => {
  it('is stable, bounded, and spreads names', () => {
    expect(nameColorIndex('Ada Lovelace')).toBe(nameColorIndex('Ada Lovelace'));
    const idx = ['Ada Lovelace', 'Bo Chen', 'Cleo Dias', 'Grace Hopper', 'Alan Turing', 'Madonna'].map((n) => nameColorIndex(n));
    expect(idx.every((i) => i >= 0 && i < 5)).toBe(true);
    expect(new Set(idx).size).toBeGreaterThan(2);
    expect(nameColorIndex('')).toBe(0);
  });
});
