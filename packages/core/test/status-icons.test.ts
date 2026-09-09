import { describe, expect, it } from 'vitest';
import { NATIVE_STATUSES, STOCK_ICON_CELLS, STOCK_ICON_DATA_URLS, STOCK_ICON_KEYS, isNativeStatus, spriteStyle, stockIconSource } from '../src/status-icons.js';

describe('native statuses', () => {
  it('ships 19 codes, six of them system locked', () => {
    expect(NATIVE_STATUSES).toHaveLength(19);
    expect(NATIVE_STATUSES.filter((s) => s.system).map((s) => s.code)).toEqual(['act', 'dis', 'ip', 'na', 'cfrm', 'pndng']);
    expect(isNativeStatus('apr')).toBe(true);
    expect(isNativeStatus('pndl')).toBe(false);
  });
  it('bundles a data URL for every stock status icon, shipped ones included', () => {
    expect(STOCK_ICON_KEYS.length).toBe(94);
    for (const k of STOCK_ICON_KEYS) expect(STOCK_ICON_DATA_URLS[k]).toMatch(/^data:image\/png;base64,/);
    for (const s of NATIVE_STATUSES) if (s.imageMapKey) expect(STOCK_ICON_KEYS).toContain(s.imageMapKey);
  });
});

describe('stockIconSource', () => {
  it('prefers the bundle, then the site sprite, then nothing', () => {
    expect(stockIconSource('icon_apr').kind).toBe('data');
    expect(stockIconSource('icon_trophy').kind).toBe('data');
    expect(stockIconSource('icon_x_thin_white').kind).toBe('none');
    const s = stockIconSource('icon_x_thin_white', 'https://studio.example.com/');
    expect(s.kind).toBe('sprite');
    if (s.kind === 'sprite') {
      expect(s.src).toBe('https://studio.example.com/images/sg_icon_image_map.png');
      expect(spriteStyle(s).backgroundPosition).toBe(`-${STOCK_ICON_CELLS['icon_x_thin_white']!.x}px -${STOCK_ICON_CELLS['icon_x_thin_white']!.y}px`);
    }
    expect(stockIconSource('icon_nope', 'https://x').kind).toBe('none');
    expect(stockIconSource(null).kind).toBe('none');
  });
});
