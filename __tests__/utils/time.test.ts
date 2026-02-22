import { getTimeAgo } from '@/utils/time';

describe('getTimeAgo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-12T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "방금 전" for less than 60 seconds ago', () => {
    const date = new Date('2026-02-12T11:59:30Z');
    expect(getTimeAgo(date)).toBe('방금 전');
  });

  it('returns minutes ago', () => {
    const date = new Date('2026-02-12T11:55:00Z');
    expect(getTimeAgo(date)).toBe('5분 전');
  });

  it('returns hours ago', () => {
    const date = new Date('2026-02-12T09:00:00Z');
    expect(getTimeAgo(date)).toBe('3시간 전');
  });

  it('returns days ago', () => {
    const date = new Date('2026-02-09T12:00:00Z');
    expect(getTimeAgo(date)).toBe('3일 전');
  });

  it('returns months ago', () => {
    const date = new Date('2025-12-12T12:00:00Z');
    expect(getTimeAgo(date)).toBe('2개월 전');
  });

  it('handles non-Date input gracefully', () => {
    const result = getTimeAgo('2026-02-12T11:59:30Z' as any);
    expect(result).toBe('방금 전');
  });

  it('returns "방금 전" for future dates', () => {
    const futureDate = new Date('2026-02-12T13:00:00Z');
    expect(getTimeAgo(futureDate)).toBe('방금 전');
  });
});
