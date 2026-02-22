import { convertTimestamp } from '@/utils/firestore';

describe('convertTimestamp', () => {
  it('converts Firestore timestamp with toDate()', () => {
    const fakeDate = new Date('2026-01-01T00:00:00Z');
    const timestamp = { toDate: () => fakeDate };
    expect(convertTimestamp(timestamp)).toBe(fakeDate);
  });

  it('returns new Date() for null', () => {
    const before = new Date();
    const result = convertTimestamp(null);
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('returns new Date() for undefined', () => {
    const before = new Date();
    const result = convertTimestamp(undefined);
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('returns new Date() for object without toDate', () => {
    const result = convertTimestamp({ seconds: 1000 });
    expect(result).toBeInstanceOf(Date);
  });
});
