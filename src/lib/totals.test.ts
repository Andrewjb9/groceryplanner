import { describe, expect, it } from 'vitest'
import {
  checkedTotalCents,
  estimatedTotalCents,
  isUnpriced,
  lineCents,
  remainingCents,
  unpricedCount,
  type TotalsEntry,
} from './totals'

function entry(overrides: Partial<TotalsEntry> = {}): TotalsEntry {
  return {
    quantity: 1,
    estimatedCents: 100,
    actualCents: null,
    isChecked: false,
    ...overrides,
  }
}

const EMPTY: TotalsEntry[] = []

describe('the empty case', () => {
  it('is zero for every total', () => {
    expect(estimatedTotalCents(EMPTY)).toBe(0)
    expect(checkedTotalCents(EMPTY)).toBe(0)
    expect(remainingCents(15000, EMPTY)).toBe(15000)
    expect(unpricedCount(EMPTY)).toBe(0)
  })
})

describe('lineCents', () => {
  it('multiplies quantity by unit price', () => {
    expect(lineCents(entry({ quantity: 3, estimatedCents: 250 }))).toBe(750)
  })

  it('prefers an actual shelf price over the estimate', () => {
    expect(lineCents(entry({ estimatedCents: 250, actualCents: 399 }))).toBe(399)
    // Zero is a real price, not a missing one.
    expect(lineCents(entry({ estimatedCents: 250, actualCents: 0 }))).toBe(0)
  })

  it('treats an unpriced entry as zero rather than guessing', () => {
    expect(lineCents(entry({ estimatedCents: null }))).toBe(0)
  })

  it('rounds fractional quantities to whole cents', () => {
    expect(lineCents(entry({ quantity: 1.5, estimatedCents: 399 }))).toBe(599)
    expect(lineCents(entry({ quantity: 0.5, estimatedCents: 333 }))).toBe(167)
  })

  it('rounds up when asked', () => {
    expect(lineCents(entry({ quantity: 1.5, estimatedCents: 399 }), { roundUp: true })).toBe(599)
    expect(lineCents(entry({ quantity: 0.5, estimatedCents: 333 }), { roundUp: true })).toBe(167)
    expect(lineCents(entry({ quantity: 0.34, estimatedCents: 100 }), { roundUp: true })).toBe(34)
    expect(lineCents(entry({ quantity: 1.01, estimatedCents: 100 }), { roundUp: true })).toBe(101)
  })
})

describe('estimatedTotalCents', () => {
  it('sums every line regardless of checked state', () => {
    const entries = [
      entry({ quantity: 2, estimatedCents: 150 }),
      entry({ quantity: 1, estimatedCents: 499, isChecked: true }),
    ]
    expect(estimatedTotalCents(entries)).toBe(300 + 499)
  })

  it('excludes unpriced entries from the total', () => {
    const entries = [entry({ estimatedCents: 500 }), entry({ estimatedCents: null })]
    expect(estimatedTotalCents(entries)).toBe(500)
  })

  // Rounding once at the end would give a different, wrong answer.
  it('rounds per line, not at the end', () => {
    const entries = [
      entry({ quantity: 0.5, estimatedCents: 101 }),
      entry({ quantity: 0.5, estimatedCents: 101 }),
    ]
    // Per line: 51 + 51 = 102. Summed first: round(101) = 101.
    expect(estimatedTotalCents(entries)).toBe(102)
    expect(estimatedTotalCents(entries)).not.toBe(101)
  })
})

describe('checkedTotalCents', () => {
  it('counts only what is in the cart', () => {
    const entries = [
      entry({ estimatedCents: 500, isChecked: true }),
      entry({ estimatedCents: 300, isChecked: false }),
      entry({ estimatedCents: 200, isChecked: true }),
    ]
    expect(checkedTotalCents(entries)).toBe(700)
  })

  it('is zero when nothing is checked', () => {
    expect(checkedTotalCents([entry(), entry()])).toBe(0)
  })
})

describe('remainingCents', () => {
  it('subtracts the cart from the budget', () => {
    const entries = [entry({ estimatedCents: 2500, isChecked: true })]
    expect(remainingCents(10000, entries)).toBe(7500)
  })

  it('goes negative when over budget', () => {
    const entries = [entry({ estimatedCents: 12000, isChecked: true })]
    expect(remainingCents(10000, entries)).toBe(-2000)
  })

  it('ignores unchecked entries', () => {
    expect(remainingCents(10000, [entry({ estimatedCents: 9999 })])).toBe(10000)
  })
})

describe('unpricedCount', () => {
  it('counts entries with no price at all', () => {
    const entries = [
      entry({ estimatedCents: null }),
      entry({ estimatedCents: null, actualCents: 250 }),
      entry({ estimatedCents: 100 }),
      entry({ estimatedCents: null }),
    ]
    expect(unpricedCount(entries)).toBe(2)
  })

  it('does not treat a zero price as unpriced', () => {
    expect(isUnpriced(entry({ estimatedCents: 0 }))).toBe(false)
    expect(unpricedCount([entry({ estimatedCents: 0 })])).toBe(0)
  })
})
