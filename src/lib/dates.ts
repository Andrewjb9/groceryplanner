// All date arithmetic goes through the Date constructor rather than adding
// milliseconds. Adding 7 * 864e5 to a timestamp lands an hour off midnight
// across a DST transition, which would quietly shift a week boundary.

const MS_PER_DAY = 86_400_000

function toDate(value: number | Date): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value)
}

/** Local midnight of the day containing `value`. */
export function startOfLocalDay(value: number | Date): number {
  const d = toDate(value)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Shifts by whole calendar days, preserving local midnight across DST. */
export function addDays(value: number | Date, days: number): number {
  const d = toDate(value)
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + days,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  ).getTime()
}

/**
 * Local midnight of the week containing `value`.
 * `weekStartDay` is 0 = Sunday, matching Date.prototype.getDay.
 */
export function startOfWeek(value: number | Date, weekStartDay: number): number {
  const d = toDate(value)
  const offset = (d.getDay() - weekStartDay + 7) % 7
  return startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset))
}

/** Whole calendar days from `startDate` to `value`. Can be negative. */
export function dayOffsetFrom(startDate: number | Date, value: number | Date): number {
  const from = startOfLocalDay(startDate)
  const to = startOfLocalDay(value)
  // Round rather than floor: a DST day is 23 or 25 hours long, so the quotient
  // is 0.958 or 1.042 rather than exactly 1.
  return Math.round((to - from) / MS_PER_DAY)
}

export function isSameLocalDay(a: number | Date, b: number | Date): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b)
}

export function isToday(value: number | Date, now: number | Date = Date.now()): boolean {
  return isSameLocalDay(value, now)
}

/** "Mon 25" -- the day rows on the week screen. */
export function formatDayLabel(value: number | Date): string {
  const d = toDate(value)
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' })
  return `${weekday} ${d.getDate()}`
}

/** "Aug 24 – Aug 30" -- the week header and history rows. */
export function formatWeekRange(startDate: number | Date): string {
  const start = toDate(startOfLocalDay(startDate))
  const end = toDate(addDays(start, 6))
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`
}
