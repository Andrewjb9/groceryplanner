// Pure serialization for backup/restore. No Dexie import here -- the database
// half lives in src/db/backup.ts -- so these functions are directly testable.
//
// iOS reclaims storage from web apps and there is no cloud sync behind this
// app, so this file is the only thing standing between a storage eviction and
// losing a year of recipes.

import {
  ALL_TABLES,
  type Entry,
  type Item,
  type Meal,
  type MealIngredient,
  type PlannedMeal,
  type Settings,
  type TableName,
  type Week,
} from '../db/types'

export const BACKUP_VERSION = 1

export interface BackupTables {
  items: Item[]
  meals: Meal[]
  mealIngredients: MealIngredient[]
  weeks: Week[]
  plannedMeals: PlannedMeal[]
  entries: Entry[]
  settings: Settings[]
}

export interface Backup {
  version: number
  /** Epoch ms. */
  exportedAt: number
  tables: BackupTables
}

export type ParseResult =
  | { ok: true; backup: Backup }
  | { ok: false; error: string }

export function emptyTables(): BackupTables {
  return {
    items: [],
    meals: [],
    mealIngredients: [],
    weeks: [],
    plannedMeals: [],
    entries: [],
    settings: [],
  }
}

export function serializeBackup(tables: BackupTables, exportedAt: number = Date.now()): string {
  const backup: Backup = { version: BACKUP_VERSION, exportedAt, tables }
  return JSON.stringify(backup, null, 2)
}

/** Row counts per table, for the "this will replace what's there" confirmation. */
export function backupCounts(tables: BackupTables): Record<TableName, number> {
  const counts = {} as Record<TableName, number>
  for (const name of ALL_TABLES) counts[name] = tables[name].length
  return counts
}

export function totalRows(tables: BackupTables): number {
  return ALL_TABLES.reduce((acc, name) => acc + tables[name].length, 0)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Every field named *Cents must be a whole number of cents. A backup that
 * smuggled a float back in would reintroduce exactly the bug the integer-cents
 * rule exists to prevent, and it would do it silently.
 */
function findBadCents(value: unknown, path: string): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const bad = findBadCents(value[i], `${path}[${i}]`)
      if (bad) return bad
    }
    return null
  }

  if (!isPlainObject(value)) return null

  for (const [key, field] of Object.entries(value)) {
    if (key.endsWith('Cents')) {
      if (field === null) continue
      if (typeof field !== 'number' || !Number.isSafeInteger(field)) {
        return `${path}.${key} is not a whole number of cents (got ${JSON.stringify(field)})`
      }
      continue
    }
    const bad = findBadCents(field, `${path}.${key}`)
    if (bad) return bad
  }

  return null
}

export function parseBackup(json: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: "That doesn't look like JSON." }
  }

  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Expected a backup object at the top level.' }
  }

  if (typeof raw.version !== 'number') {
    return { ok: false, error: 'Missing a version number — is this a grocery backup?' }
  }
  if (raw.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `Backup is version ${raw.version}, but this app reads version ${BACKUP_VERSION}.`,
    }
  }

  if (!isPlainObject(raw.tables)) {
    return { ok: false, error: 'Missing the tables object.' }
  }

  const tables = emptyTables()
  for (const name of ALL_TABLES) {
    const table = raw.tables[name]
    if (table === undefined) {
      return { ok: false, error: `Backup is missing the "${name}" table.` }
    }
    if (!Array.isArray(table)) {
      return { ok: false, error: `Table "${name}" is not a list of rows.` }
    }
    for (let i = 0; i < table.length; i++) {
      if (!isPlainObject(table[i])) {
        return { ok: false, error: `Row ${i} of "${name}" is not an object.` }
      }
    }
    // Validated structurally above; the row shapes themselves are trusted, as
    // this file only ever reads backups this same app wrote.
    tables[name] = table as never
  }

  const badCents = findBadCents(tables, 'tables')
  if (badCents) return { ok: false, error: badCents }

  return {
    ok: true,
    backup: {
      version: raw.version,
      exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
      tables,
    },
  }
}

/** grocery-backup-2026-08-24.json */
export function backupFilename(exportedAt: number = Date.now()): string {
  const d = new Date(exportedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `grocery-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}
