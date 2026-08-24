// Money is an integer count of cents, everywhere. Parsing and formatting are
// the only two places a decimal string is allowed to exist, and both work on
// digit strings rather than floats -- `parseFloat('1.005') * 100` is
// 100.49999999999999, which silently loses a cent.

/** Splits a non-negative cents value into its dollar and cent digit strings. */
function splitCents(cents: number): { dollars: string; remainder: string } {
  const whole = Math.floor(cents / 100)
  const remainder = cents % 100
  return {
    dollars: String(whole),
    remainder: String(remainder).padStart(2, '0'),
  }
}

function withThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Parses user input into integer cents. Returns null for anything that isn't a
 * well-formed amount, so callers can distinguish "empty/invalid" from "zero".
 *
 * Accepts: "3", "3.5", "3.50", "$3.50", " $1,234.56 ", ".50", "3.", "-2.25"
 */
export function parseCents(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  let rest = trimmed
  let negative = false

  // Sign may sit on either side of the currency symbol: "-$3.50" or "$-3.50".
  if (rest.startsWith('-')) {
    negative = true
    rest = rest.slice(1).trimStart()
  }
  if (rest.startsWith('$')) rest = rest.slice(1).trimStart()
  if (!negative && rest.startsWith('-')) {
    negative = true
    rest = rest.slice(1).trimStart()
  }

  const match = /^(\d{1,3}(?:,\d{3})*|\d*)(?:\.(\d*))?$/.exec(rest)
  if (!match) return null

  const wholePart = (match[1] ?? '').replace(/,/g, '')
  const fractionPart = match[2] ?? ''

  // "." alone, or "" -- no digits anywhere means this isn't an amount.
  if (wholePart === '' && fractionPart === '') return null

  const whole = wholePart === '' ? 0 : Number(wholePart)
  if (!Number.isSafeInteger(whole)) return null

  const tens = Number(fractionPart[0] ?? '0')
  const ones = Number(fractionPart[1] ?? '0')
  let cents = whole * 100 + tens * 10 + ones

  // Round half-up on the third decimal digit, using the digit itself rather
  // than float arithmetic, so "1.005" becomes 101 and not 100.
  if (Number(fractionPart[2] ?? '0') >= 5) cents += 1

  if (!Number.isSafeInteger(cents)) return null
  return negative ? -cents : cents
}

/** Renders cents for display: 350 -> "$3.50", -350 -> "-$3.50". */
export function formatCents(cents: number): string {
  const { dollars, remainder } = splitCents(Math.abs(cents))
  return `${cents < 0 ? '-' : ''}$${withThousands(dollars)}.${remainder}`
}

/** Renders cents for an editable field: 350 -> "3.50". No symbol, no commas. */
export function centsToInputValue(cents: number): string {
  const { dollars, remainder } = splitCents(Math.abs(cents))
  return `${cents < 0 ? '-' : ''}${dollars}.${remainder}`
}
