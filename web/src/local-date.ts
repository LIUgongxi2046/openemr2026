/**
 * Return the calendar date observed by the configured hospital time zone.
 *
 * Clinical day-based queries must not use `toISOString()`: that converts to UTC
 * and returns the previous day during the first eight hours of a China workday.
 * It must also not depend on the workstation time zone because shared terminals,
 * containers and browser automation may run in UTC.
 */
export function localCalendarDate(value = new Date(), timeZone = 'Asia/Shanghai'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const field = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${field('year')}-${field('month')}-${field('day')}`;
}
