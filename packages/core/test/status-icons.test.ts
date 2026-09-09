import { describe, expect, it } from 'vitest';
import { NATIVE_ICON_DATA_URLS, NATIVE_STATUSES, STOCK_ICON_CELLS, isNativeStatus, spriteStyle, stockIconSource } from '../src/status-icons.js';

describe('native statuses', () => {
  it('ships 19 codes, six of them system locked', () => {
    expect(NATIVE_STATUSES).toHaveLength(19);
    expect(NATIVE_STATUSES.filter((s) => s.system).map((s) => s.code)).toEqual(['act', 'dis', 'ip', 'na', 'cfrm', 'pndng']);
    expect(isNativeStatus('apr')).toBe(true);
    expect(isNativeStatus('pndl')).toBe(false);
  });
  it('bundles a data URL for every shipped image_map icon', () => {
    for (const s of NATIVE_STATUSES) if (s.imageMapKey) expect(NATIVE_ICON_DATA_URLS[s.imageMapKey]).toMatch(/^data:image\/png;base64,/);
  });
});

describe('stockIconSource', () => {
  it('prefers the bundle, then the site sprite, then nothing', () => {
    expect(stockIconSource('icon_apr').kind).toBe('data');
    expect(stockIconSource('icon_trophy').kind).toBe('none');
    const s = stockIconSource('icon_trophy', 'https://studio.example.com/');
    expect(s.kind).toBe('sprite');
    if (s.kind === 'sprite') {
      expect(s.src).toBe('https://studio.example.com/images/sg_icon_image_map.png');
      expect(spriteStyle(s).backgroundPosition).toBe(`-${STOCK_ICON_CELLS['icon_trophy']!.x}px -${STOCK_ICON_CELLS['icon_trophy']!.y}px`);
    }
    expect(stockIconSource('icon_nope', 'https://x').kind).toBe('none');
    expect(stockIconSource(null).kind).toBe('none');
  });
});
