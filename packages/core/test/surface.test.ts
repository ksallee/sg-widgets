/** What the package's entry points hand out, which a publish then freezes. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.js';
import * as mock from '../src/mock.js';

describe('the root entry', () => {
  it('leaves the mock site on the mock entry', () => {
    expect(Object.keys(mock)).toContain('MockClient');
    for (const name of ['MockClient', 'MOCK_NOW']) expect(Object.keys(core)).not.toContain(name);
  });
});
