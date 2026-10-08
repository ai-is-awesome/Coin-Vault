import { describe, expect, it } from 'vitest';
import { loginHref, safeNextPath } from './navigation';

describe('safeNextPath', () => {
  it('returns same-site paths', () => {
    expect(safeNextPath('?next=%2Fwallet')).toBe('/wallet');
    expect(safeNextPath(new URL(`http://x${loginHref('/products/abc?x=1')}`).search)).toBe('/products/abc?x=1');
  });

  it('falls back to / for missing or off-site targets (open-redirect protection)', () => {
    for (const search of [
      '',
      '?next=',
      '?next=https://evil.com',
      '?next=//evil.com',
      '?next=/%5Cevil.com',
      '?next=wallet',
    ]) {
      expect(safeNextPath(search)).toBe('/');
    }
  });
});
