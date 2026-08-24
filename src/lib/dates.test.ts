import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayOffsetFrom,
  formatWeekRange,
  isSameLocalDay,
  isToday,
  startOfLocalDay,
  startOfWeek,
} from './dates'

/** Every day of a full year, so whatever DST transitions the local zone has
 *  are crossed by these tests without hard-coding a timezone. */
function everyDayOfYear(year: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, 0, 1, 12, 0, 0)
  while (d.getFullYear() === year) {
    days.push(new Date(d.getTime()))
    d.setDate(d.getDate() + 1)
  }
  return days
}

const YEAR_2026 = everyDayOfYear(2026)

describe('startOfLocalDay', () => {
  it('lands on local midnight', () => {
    const d = new Date(2026, 7, 24, 15, 42, 7, 123)
    const start = new Date(startOfLocalDay(d))
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0])
    expect(start.getDate()).toBe(24)
  })

  it('is idempotent', () => {
    const once = startOfLocalDay(new Date(2026, 7, 24, 15, 42))
    expect(startOfLocalDay(once)).toBe(once)
  })

  it('stays at midnight on every day of the year, DST included', () => {
    for (const day of YEAR_2026) {
      expect(new Date(startOfLocalDay(day)).getHours()).toBe(0)
    }
  })
})

describe('addDays', () => {
  it('moves forward and backward by calendar days', () => {
    const base = startOfLocalDay(new Date(2026, 7, 24))
    expect(new Date(addDays(base, 1)).getDate()).toBe(25)
    expect(new Date(addDays(base, -1)).getDate()).toBe(23)
  })

  it('crosses month and year boundaries', () => {
    const endOfYear = startOfLocalDay(new Date(2026, 11, 31))
    const next = new Date(addDays(endOfYear, 1))
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2027, 0, 1])
  })

  // Adding 864e5 ms would drift off midnight across a DST transition.
  it('preserves midnight across every day of the year', () => {
    for (const day of YEAR_2026) {
      const base = startOfLocalDay(day)
      expect(new Date(addDays(base, 1)).getHours()).toBe(0)
      expect(new Date(addDays(base, 7)).getHours()).toBe(0)
    }
  })
})

describe('startOfWeek', () => {
  it('respects every weekStartDay', () => {
    // 2026-08-24 is a Monday.
    const monday = new Date(2026, 7, 24, 9, 30)
    for (let weekStartDay = 0; weekStartDay < 7; weekStartDay++) {
      const start = new Date(startOfWeek(monday, weekStartDay))
      expect(start.getDay()).toBe(weekStartDay)
      expect(start.getHours()).toBe(0)
      // Never jumps forward past the date it was asked about.
      expect(start.getTime()).toBeLessThanOrEqual(startOfLocalDay(monday))
      expect(dayOffsetFrom(start, monday)).toBeLessThan(7)
    }
  })

  it('returns the day itself when it is already the boundary', () => {
    const sunday = new Date(2026, 7, 23, 18, 0)
    expect(startOfWeek(sunday, 0)).toBe(startOfLocalDay(sunday))
  })

  it('is idempotent and stays on the boundary all year', () => {
    for (const day of YEAR_2026) {
      const start = startOfWeek(day, 0)
      expect(startOfWeek(start, 0)).toBe(start)
      expect(new Date(start).getHours()).toBe(0)
      expect(new Date(start).getDay()).toBe(0)
    }
  })
})

describe('dayOffsetFrom', () => {
  it('counts whole calendar days in both directions', () => {
    const base = startOfLocalDay(new Date(2026, 7, 24))
    expect(dayOffsetFrom(base, base)).toBe(0)
    expect(dayOffsetFrom(base, addDays(base, 6))).toBe(6)
    expect(dayOffsetFrom(base, addDays(base, -3))).toBe(-3)
  })

  it('ignores the time of day', () => {
    const base = startOfLocalDay(new Date(2026, 7, 24))
    expect(dayOffsetFrom(base, new Date(2026, 7, 24, 23, 59, 59))).toBe(0)
    expect(dayOffsetFrom(base, new Date(2026, 7, 25, 0, 0, 1))).toBe(1)
  })

  // A 23- or 25-hour DST day must still count as exactly one.
  it('counts exactly one day across every transition in the year', () => {
    for (const day of YEAR_2026) {
      expect(dayOffsetFrom(day, addDays(day, 1))).toBe(1)
    }
  })
})

describe('isSameLocalDay / isToday', () => {
  it('compares by calendar day, not by elapsed time', () => {
    expect(isSameLocalDay(new Date(2026, 7, 24, 0, 1), new Date(2026, 7, 24, 23, 59))).toBe(true)
    expect(isSameLocalDay(new Date(2026, 7, 24, 23, 59), new Date(2026, 7, 25, 0, 1))).toBe(false)
  })

  it('takes an injectable now', () => {
    const now = new Date(2026, 7, 24, 12, 0)
    expect(isToday(new Date(2026, 7, 24, 6, 0), now)).toBe(true)
    expect(isToday(new Date(2026, 7, 25, 6, 0), now)).toBe(false)
  })
})

describe('formatWeekRange', () => {
  it('spans the start day through six days later', () => {
    const range = formatWeekRange(new Date(2026, 7, 23))
    expect(range).toContain('23')
    expect(range).toContain('29')
    expect(range).toContain('–')
  })
})
