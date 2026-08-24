// Pure. No Dexie, no side effects: data in, numbers out. Everything money is
// integer cents, and rounding happens ONCE PER LINE -- never at the end --
// so the displayed total always equals the sum of the displayed rows.

import type { Entry } from '../db/types'

/** The only fields the totals care about, so callers can pass anything shaped like an entry. */
export type TotalsEntry = Pick<Entry, 'quantity' | 'estimatedCents' | 'actualCents' | 'isChecked'>

export interface TotalsOptions {
  /** Mirrors settings.roundEstimatesUp -- padding beats a nasty surprise. */
  roundUp?: boolean
}

/** The unit price a line is costed at: an actual shelf price wins over the estimate. */
export function unitCentsFor(entry: TotalsEntry): number | null {
  return entry.actualCents ?? entry.estimatedCents
}

/** An entry with no known price contributes nothing rather than guessing. */
export function isUnpriced(entry: TotalsEntry): boolean {
  return unitCentsFor(entry) === null
}

/** Cost of a single line, rounded to whole cents. */
export function lineCents(entry: TotalsEntry, opts: TotalsOptions = {}): number {
  const unit = unitCentsFor(entry) ?? 0
  const exact = entry.quantity * unit
  return opts.roundUp ? Math.ceil(exact) : Math.round(exact)
}

function sum(entries: readonly TotalsEntry[], opts: TotalsOptions): number {
  return entries.reduce((acc, entry) => acc + lineCents(entry, opts), 0)
}

/** Everything on the list, priced. */
export function estimatedTotalCents(
  entries: readonly TotalsEntry[],
  opts: TotalsOptions = {},
): number {
  return sum(entries, opts)
}

/** Only what's already in the cart. */
export function checkedTotalCents(
  entries: readonly TotalsEntry[],
  opts: TotalsOptions = {},
): number {
  return sum(
    entries.filter((entry) => entry.isChecked),
    opts,
  )
}

/** Budget minus what's in the cart. Negative means over. */
export function remainingCents(
  budgetCents: number,
  entries: readonly TotalsEntry[],
  opts: TotalsOptions = {},
): number {
  return budgetCents - checkedTotalCents(entries, opts)
}

/** Drives the "3 items have no price yet" banner, so the estimate is never silently low. */
export function unpricedCount(entries: readonly TotalsEntry[]): number {
  return entries.filter(isUnpriced).length
}
