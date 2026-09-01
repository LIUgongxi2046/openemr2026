import { describe, expect, it } from 'vitest';
import { localCalendarDate } from './local-date';

describe('localCalendarDate', () => {
  it('uses the hospital time zone instead of a UTC conversion', () => {
    const chinaMidnight = new Date('2026-08-31T16:15:00.000Z');

    expect(localCalendarDate(chinaMidnight)).toBe('2026-09-01');
  });

  it('pads single digit months and days', () => {
    expect(localCalendarDate(new Date('2026-01-02T04:00:00.000Z'))).toBe('2026-01-02');
  });

  it('supports an explicitly configured hospital time zone', () => {
    expect(localCalendarDate(new Date('2026-09-01T00:30:00.000Z'), 'America/New_York')).toBe('2026-08-31');
  });
});
