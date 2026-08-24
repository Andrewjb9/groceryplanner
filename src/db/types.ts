// Plain entity types. Deliberately free of any Dexie import so that the pure
// modules (lib/totals.ts, lib/generateList.ts) can depend on these shapes
// without pulling the database in.

/** Every table, in a stable order. Used by backup, restore and wipe. */
export const ALL_TABLES = [
  'items',
  'meals',
  'mealIngredients',
  'weeks',
  'plannedMeals',
  'entries',
  'settings',
] as const

export type TableName = (typeof ALL_TABLES)[number]

export const CATEGORIES = [
  'produce',
  'dairy',
  'meat',
  'pantry',
  'frozen',
  'household',
  'other',
] as const

export type Category = (typeof CATEGORIES)[number]

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'other'] as const

export type Slot = (typeof SLOTS)[number]

/** The catalog. Persists across weeks; this is what makes price memory work. */
export interface Item {
  id?: number
  name: string
  /** Lowercased + trimmed, used for dedupe on add. */
  normalizedName: string
  category: Category
  lastPaidCents: number | null
  /** Epoch ms. */
  lastPurchasedAt: number | null
  purchaseCount: number
  /** Salt, oil — assumed on hand, excluded from generation. */
  isStaple: boolean
  isArchived: boolean
}

/** The recipe library. */
export interface Meal {
  id?: number
  name: string
  /** Free text: loose method, links, reminders. */
  notes: string
  servings: number
  tags: string[]
  timesCooked: number
  lastCookedAt: number | null
}

/** Joins a meal to a catalog item. */
export interface MealIngredient {
  id?: number
  mealId: number
  itemId: number
  /** May be fractional (1.5 lb). */
  quantity: number
  /** 'ea' | 'lb' | 'oz' | 'cup' | 'tbsp' — free text. */
  unit: string
  /** Excluded from generation unless toggled on. */
  isOptional: boolean
}

/** One budget period. */
export interface Week {
  id?: number
  /** Epoch ms, normalized to local midnight. */
  startDate: number
  budgetCents: number
  /** Null until the trip is closed out. */
  actualTotalCents: number | null
  isClosed: boolean
  notes: string
}

/** A meal assigned to a slot. */
export interface PlannedMeal {
  id?: number
  weekId: number
  /** Null for a freeform entry. */
  mealId: number | null
  /** Used when mealId is null: "leftovers", "out". */
  freeformTitle: string
  /** 0-6 from the week's startDate. */
  dayOffset: number
  slot: Slot
  /** Default 1; cooking double scales ingredients. */
  servingsMultiplier: number
}

/** One line on one week's list. */
export interface Entry {
  id?: number
  weekId: number
  itemId: number
  quantity: number
  unit: string
  /** Snapshot of item.lastPaidCents at add time; user-overridable. */
  estimatedCents: number | null
  /** Entered in shopping mode if the shelf price surprised me. */
  actualCents: number | null
  isChecked: boolean
  sortIndex: number
  /** CRITICAL: only these are touched by regeneration. */
  isFromMealPlan: boolean
  /** Protects a manual price from being clobbered on regenerate. */
  priceWasOverridden: boolean
  /** So a row can show "chili, stir fry". */
  contributingMealNames: string[]
}

/** Single row, id: 1. */
export interface Settings {
  id: 1
  /** 0 = Sunday. */
  weekStartDay: number
  defaultBudgetCents: number
  /** Padding beats a nasty surprise. */
  roundEstimatesUp: boolean
  excludeStaplesFromGeneration: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  weekStartDay: 0,
  defaultBudgetCents: 15000,
  roundEstimatesUp: true,
  excludeStaplesFromGeneration: true,
}
