import Dexie, { type EntityTable } from 'dexie'
import {
  ALL_TABLES,
  DEFAULT_SETTINGS,
  type Entry,
  type Item,
  type Meal,
  type MealIngredient,
  type PlannedMeal,
  type Settings,
  type Week,
} from './types'

// IndexedDB cannot index boolean values -- a record with a boolean in an
// indexed field is silently omitted from that index rather than erroring. So
// isChecked / isStaple / isArchived / isFromMealPlan are deliberately NOT
// indexed here; filter them in memory, which is correct at this data size.
const db = new Dexie('grocery-planner') as Dexie & {
  items: EntityTable<Item, 'id'>
  meals: EntityTable<Meal, 'id'>
  mealIngredients: EntityTable<MealIngredient, 'id'>
  weeks: EntityTable<Week, 'id'>
  plannedMeals: EntityTable<PlannedMeal, 'id'>
  entries: EntityTable<Entry, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  items: '++id, normalizedName, category, purchaseCount, lastPurchasedAt',
  meals: '++id, name, lastCookedAt, timesCooked, *tags',
  mealIngredients: '++id, mealId, itemId, [mealId+itemId]',
  weeks: '++id, startDate',
  plannedMeals: '++id, weekId, mealId, [weekId+dayOffset]',
  entries: '++id, weekId, itemId, [weekId+sortIndex]',
  settings: 'id',
})

/** Creates the singleton settings row on first run. Safe to call repeatedly. */
export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get(1)
  if (existing) return existing
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export { ALL_TABLES, db }
export type { TableName } from './types'
