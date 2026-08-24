import { describe, expect, it } from 'vitest'
import {
  BACKUP_VERSION,
  backupCounts,
  backupFilename,
  emptyTables,
  parseBackup,
  serializeBackup,
  totalRows,
  type BackupTables,
} from './export'
import { DEFAULT_SETTINGS } from '../db/types'

function populatedTables(): BackupTables {
  return {
    items: [
      {
        id: 1,
        name: 'Whole milk, gallon',
        normalizedName: 'whole milk, gallon',
        category: 'dairy',
        lastPaidCents: 429,
        lastPurchasedAt: 1_756_000_000_000,
        purchaseCount: 12,
        isStaple: false,
        isArchived: false,
      },
      {
        id: 2,
        name: 'Olive oil',
        normalizedName: 'olive oil',
        category: 'pantry',
        lastPaidCents: null,
        lastPurchasedAt: null,
        purchaseCount: 0,
        isStaple: true,
        isArchived: false,
      },
    ],
    meals: [
      {
        id: 1,
        name: 'Chili',
        notes: 'Double the cumin.',
        servings: 4,
        tags: ['batch cook'],
        timesCooked: 3,
        lastCookedAt: 1_756_000_000_000,
      },
    ],
    mealIngredients: [{ id: 1, mealId: 1, itemId: 1, quantity: 1.5, unit: 'lb', isOptional: false }],
    weeks: [
      {
        id: 1,
        startDate: 1_756_000_000_000,
        budgetCents: 15000,
        actualTotalCents: 14237,
        isClosed: true,
        notes: '',
      },
    ],
    plannedMeals: [
      {
        id: 1,
        weekId: 1,
        mealId: 1,
        freeformTitle: '',
        dayOffset: 0,
        slot: 'dinner',
        servingsMultiplier: 1,
      },
    ],
    entries: [
      {
        id: 1,
        weekId: 1,
        itemId: 1,
        quantity: 2,
        unit: 'ea',
        estimatedCents: 429,
        actualCents: null,
        isChecked: true,
        sortIndex: 0,
        isFromMealPlan: true,
        priceWasOverridden: false,
        contributingMealNames: ['Chili'],
      },
    ],
    settings: [DEFAULT_SETTINGS],
  }
}

describe('round trip', () => {
  it('survives serialize then parse without loss', () => {
    const tables = populatedTables()
    const result = parseBackup(serializeBackup(tables, 1_756_000_000_000))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.tables).toEqual(tables)
    expect(result.backup.version).toBe(BACKUP_VERSION)
    expect(result.backup.exportedAt).toBe(1_756_000_000_000)
  })

  it('survives an empty database', () => {
    const result = parseBackup(serializeBackup(emptyTables()))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.tables).toEqual(emptyTables())
    expect(totalRows(result.backup.tables)).toBe(0)
  })

  it('keeps cents as integers across the trip', () => {
    const result = parseBackup(serializeBackup(populatedTables()))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.tables.items[0]?.lastPaidCents).toBe(429)
    expect(result.backup.tables.weeks[0]?.actualTotalCents).toBe(14237)
    expect(Number.isInteger(result.backup.tables.settings[0]?.defaultBudgetCents)).toBe(true)
  })
})

describe('parseBackup rejects bad input', () => {
  it('rejects malformed JSON', () => {
    const result = parseBackup('{ not json')
    expect(result).toMatchObject({ ok: false })
  })

  it('rejects non-object top levels', () => {
    expect(parseBackup('[]').ok).toBe(false)
    expect(parseBackup('"hello"').ok).toBe(false)
    expect(parseBackup('null').ok).toBe(false)
  })

  it('rejects a missing version', () => {
    const result = parseBackup(JSON.stringify({ tables: emptyTables() }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('version')
  })

  it('rejects a version it cannot read', () => {
    const result = parseBackup(JSON.stringify({ version: 99, tables: emptyTables() }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('99')
  })

  it('rejects a missing tables object', () => {
    expect(parseBackup(JSON.stringify({ version: BACKUP_VERSION })).ok).toBe(false)
  })

  it('rejects a missing table', () => {
    const tables: Partial<BackupTables> = emptyTables()
    delete tables.entries
    const result = parseBackup(JSON.stringify({ version: BACKUP_VERSION, tables }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('entries')
  })

  it('rejects a table that is not a list', () => {
    const tables = { ...emptyTables(), items: { nope: true } }
    const result = parseBackup(JSON.stringify({ version: BACKUP_VERSION, tables }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('items')
  })

  it('rejects rows that are not objects', () => {
    const tables = { ...emptyTables(), items: ['nope'] }
    expect(parseBackup(JSON.stringify({ version: BACKUP_VERSION, tables })).ok).toBe(false)
  })
})

// The integer-cents rule is the whole point of the app's money handling. A
// backup must not be able to smuggle a float past it.
describe('cents validation', () => {
  it('rejects a fractional cents value', () => {
    const tables = populatedTables()
    ;(tables.items[0] as { lastPaidCents: number }).lastPaidCents = 4.29
    const result = parseBackup(serializeBackup(tables))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('lastPaidCents')
  })

  it('rejects a cents value that is not a number', () => {
    const tables = populatedTables()
    ;(tables.weeks[0] as unknown as { budgetCents: string }).budgetCents = '150.00'
    expect(parseBackup(serializeBackup(tables)).ok).toBe(false)
  })

  it('finds bad cents nested anywhere, not just at the top level', () => {
    const tables = populatedTables()
    ;(tables.entries[0] as { actualCents: number | null }).actualCents = 0.5
    const result = parseBackup(serializeBackup(tables))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('actualCents')
  })

  it('accepts null cents, which just means unpriced', () => {
    const tables = populatedTables()
    ;(tables.items[0] as { lastPaidCents: number | null }).lastPaidCents = null
    expect(parseBackup(serializeBackup(tables)).ok).toBe(true)
  })

  it('accepts zero and negative whole cents', () => {
    const tables = populatedTables()
    ;(tables.items[0] as { lastPaidCents: number | null }).lastPaidCents = 0
    ;(tables.weeks[0] as { actualTotalCents: number | null }).actualTotalCents = -100
    expect(parseBackup(serializeBackup(tables)).ok).toBe(true)
  })
})

describe('backupCounts / totalRows', () => {
  it('reports what an import is about to replace', () => {
    const counts = backupCounts(populatedTables())
    expect(counts.items).toBe(2)
    expect(counts.meals).toBe(1)
    expect(counts.entries).toBe(1)
    expect(totalRows(populatedTables())).toBe(8)
  })

  it('reports zeroes for an empty database', () => {
    expect(backupCounts(emptyTables())).toEqual({
      items: 0,
      meals: 0,
      mealIngredients: 0,
      weeks: 0,
      plannedMeals: 0,
      entries: 0,
      settings: 0,
    })
  })
})

describe('backupFilename', () => {
  it('is dated and zero-padded', () => {
    expect(backupFilename(new Date(2026, 7, 4, 12).getTime())).toBe('grocery-backup-2026-08-04.json')
    expect(backupFilename(new Date(2026, 11, 25, 12).getTime())).toBe(
      'grocery-backup-2026-12-25.json',
    )
  })
})
