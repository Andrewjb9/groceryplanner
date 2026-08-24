import { describe, expect, it } from 'vitest'
import { centsToInputValue, formatCents, parseCents } from './money'

describe('parseCents', () => {
  it('parses plain amounts', () => {
    expect(parseCents('3')).toBe(300)
    expect(parseCents('3.5')).toBe(350)
    expect(parseCents('3.50')).toBe(350)
    expect(parseCents('0')).toBe(0)
    expect(parseCents('0.07')).toBe(7)
  })

  it('tolerates the shapes a person actually types', () => {
    expect(parseCents('$3.50')).toBe(350)
    expect(parseCents('  $3.50  ')).toBe(350)
    expect(parseCents('$1,234.56')).toBe(123456)
    expect(parseCents('.50')).toBe(50)
    expect(parseCents('3.')).toBe(300)
  })

  it('handles negatives with the sign on either side of the symbol', () => {
    expect(parseCents('-2.25')).toBe(-225)
    expect(parseCents('-$2.25')).toBe(-225)
    expect(parseCents('$-2.25')).toBe(-225)
  })

  // The whole reason this module exists.
  it('does not lose a cent to float arithmetic', () => {
    // parseFloat('1.005') * 100 === 100.49999999999999, which rounds to 100.
    expect(parseCents('1.005')).toBe(101)
    expect(parseCents('8.15')).toBe(815)
    expect(parseCents('0.1')! + parseCents('0.2')!).toBe(parseCents('0.3'))
    expect(parseCents('4.35')).toBe(435)
    expect(parseCents('1.115')).toBe(112)
  })

  it('rounds beyond two decimals rather than truncating', () => {
    expect(parseCents('1.004')).toBe(100)
    expect(parseCents('1.006')).toBe(101)
    expect(parseCents('2.999')).toBe(300)
  })

  it('returns null for anything that is not an amount', () => {
    expect(parseCents('')).toBeNull()
    expect(parseCents('   ')).toBeNull()
    expect(parseCents('.')).toBeNull()
    expect(parseCents('abc')).toBeNull()
    expect(parseCents('3.5.1')).toBeNull()
    expect(parseCents('1,23.45')).toBeNull()
    expect(parseCents('$')).toBeNull()
    expect(parseCents('12 34')).toBeNull()
    expect(parseCents('1e3')).toBeNull()
  })
})

describe('formatCents', () => {
  it('formats to two decimal places', () => {
    expect(formatCents(0)).toBe('$0.00')
    expect(formatCents(7)).toBe('$0.07')
    expect(formatCents(70)).toBe('$0.70')
    expect(formatCents(350)).toBe('$3.50')
    expect(formatCents(300)).toBe('$3.00')
  })

  it('groups thousands and keeps the sign outside the symbol', () => {
    expect(formatCents(123456)).toBe('$1,234.56')
    expect(formatCents(100000000)).toBe('$1,000,000.00')
    expect(formatCents(-350)).toBe('-$3.50')
  })
})

describe('centsToInputValue', () => {
  it('renders a bare editable value', () => {
    expect(centsToInputValue(350)).toBe('3.50')
    expect(centsToInputValue(0)).toBe('0.00')
    expect(centsToInputValue(123456)).toBe('1234.56')
    expect(centsToInputValue(-225)).toBe('-2.25')
  })

  it('round-trips through parseCents', () => {
    for (const cents of [0, 1, 7, 99, 100, 815, 123456, -225]) {
      expect(parseCents(centsToInputValue(cents))).toBe(cents)
    }
  })
})
