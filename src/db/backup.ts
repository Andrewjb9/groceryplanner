// The impure half of backup/restore. The serialization logic it hands off to
// lives in src/lib/export.ts and is pure, so it can be tested without a
// database. This file does nothing but move rows.

import { db } from './schema'
import { emptyTables, type BackupTables } from '../lib/export'

/** Reads every table into a plain object ready for serialization. */
export async function readBackup(): Promise<BackupTables> {
  const [items, meals, mealIngredients, weeks, plannedMeals, entries, settings] = await Promise.all([
    db.items.toArray(),
    db.meals.toArray(),
    db.mealIngredients.toArray(),
    db.weeks.toArray(),
    db.plannedMeals.toArray(),
    db.entries.toArray(),
    db.settings.toArray(),
  ])
  return { items, meals, mealIngredients, weeks, plannedMeals, entries, settings }
}

/**
 * Replaces the entire database with the contents of a backup.
 *
 * Every clear and every insert happens inside ONE transaction: a restore that
 * wiped the database and then failed halfway through reloading it would be the
 * worst possible outcome for a file whose only job is to prevent data loss.
 */
export async function restoreBackup(tables: BackupTables): Promise<void> {
  await db.transaction(
    'rw',
    [db.items, db.meals, db.mealIngredients, db.weeks, db.plannedMeals, db.entries, db.settings],
    async () => {
      await Promise.all([
        db.items.clear(),
        db.meals.clear(),
        db.mealIngredients.clear(),
        db.weeks.clear(),
        db.plannedMeals.clear(),
        db.entries.clear(),
        db.settings.clear(),
      ])
      await Promise.all([
        db.items.bulkAdd(tables.items),
        db.meals.bulkAdd(tables.meals),
        db.mealIngredients.bulkAdd(tables.mealIngredients),
        db.weeks.bulkAdd(tables.weeks),
        db.plannedMeals.bulkAdd(tables.plannedMeals),
        db.entries.bulkAdd(tables.entries),
        db.settings.bulkAdd(tables.settings),
      ])
    },
  )
}

/** Empties every table. Used by the dev-only wipe, and to test a restore. */
export async function wipeAll(): Promise<void> {
  await restoreBackup(emptyTables())
}
