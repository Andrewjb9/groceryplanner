// Development-only sample data. Never invoked from a production build -- the
// Settings screen only renders the button under import.meta.env.DEV.

import { restoreBackup } from './backup'
import { emptyTables } from '../lib/export'
import { addDays, startOfWeek } from '../lib/dates'
import {
  DEFAULT_SETTINGS,
  type Category,
  type Entry,
  type Item,
  type Meal,
  type MealIngredient,
  type PlannedMeal,
  type Week,
} from './types'

type ItemSpec = [name: string, category: Category, lastPaidCents: number | null, isStaple?: true]

const ITEM_SPECS: ItemSpec[] = [
  // produce
  ['Yellow onions, 3 lb bag', 'produce', 399],
  ['Garlic, head', 'produce', 89],
  ['Bell peppers', 'produce', 149],
  ['Carrots, 1 lb', 'produce', 129],
  ['Broccoli crown', 'produce', 249],
  ['Baby spinach, 5 oz', 'produce', 379],
  ['Roma tomatoes', 'produce', 119],
  ['Limes', 'produce', 50],
  ['Scallions, bunch', 'produce', 99],
  ['Russet potatoes, 5 lb', 'produce', 449],
  ['Ginger root', 'produce', 79],
  // dairy
  ['Whole milk, gallon', 'dairy', 429],
  ['Large eggs, dozen', 'dairy', 519],
  ['Unsalted butter, 1 lb', 'dairy', 599],
  ['Sharp cheddar, 8 oz', 'dairy', 449],
  ['Greek yogurt, 32 oz', 'dairy', 649],
  ['Sour cream, 16 oz', 'dairy', 299],
  // meat
  ['Chicken thighs, boneless', 'meat', 449],
  ['Ground beef, 85/15', 'meat', 649],
  ['Bacon, 12 oz', 'meat', 699],
  ['Salmon fillet', 'meat', 1199],
  // pantry
  ['Olive oil', 'pantry', 899, true],
  ['Kosher salt', 'pantry', 349, true],
  ['Black peppercorns', 'pantry', 599, true],
  ['Soy sauce', 'pantry', 379, true],
  ['Cumin, ground', 'pantry', 449, true],
  ['Canned black beans', 'pantry', 119],
  ['Crushed tomatoes, 28 oz', 'pantry', 249],
  ['Long grain rice, 2 lb', 'pantry', 379],
  ['Spaghetti, 1 lb', 'pantry', 189],
  ['Chicken stock, 32 oz', 'pantry', 329],
  // frozen
  ['Frozen peas, 16 oz', 'frozen', 219],
  ['Frozen berries, 16 oz', 'frozen', 499],
  // household
  ['Paper towels, 6 rolls', 'household', 899],
  ['Dish soap', 'household', 449],
  ['Trash bags, 40 ct', 'household', 1099],
]

type MealSpec = {
  name: string
  notes: string
  servings: number
  tags: string[]
  timesCooked: number
  /** [item name, quantity, unit, optional?] */
  ingredients: [string, number, string, boolean?][]
}

const MEAL_SPECS: MealSpec[] = [
  {
    name: 'Beef chili',
    notes: 'Double the cumin. Better on the second day.',
    servings: 4,
    tags: ['batch cook'],
    timesCooked: 7,
    ingredients: [
      ['Ground beef, 85/15', 1, 'lb'],
      ['Yellow onions, 3 lb bag', 1, 'ea'],
      ['Canned black beans', 2, 'ea'],
      ['Crushed tomatoes, 28 oz', 1, 'ea'],
      ['Cumin, ground', 2, 'tbsp'],
      ['Sour cream, 16 oz', 1, 'ea', true],
    ],
  },
  {
    name: 'Chicken stir fry',
    notes: 'Get the pan properly hot before anything goes in.',
    servings: 2,
    tags: ['quick'],
    timesCooked: 12,
    ingredients: [
      ['Chicken thighs, boneless', 1, 'lb'],
      ['Broccoli crown', 1, 'ea'],
      ['Bell peppers', 2, 'ea'],
      ['Ginger root', 1, 'ea'],
      ['Soy sauce', 3, 'tbsp'],
      ['Long grain rice, 2 lb', 1, 'cup'],
    ],
  },
  {
    name: 'Spaghetti bolognese',
    notes: '',
    servings: 4,
    tags: ['batch cook'],
    timesCooked: 9,
    ingredients: [
      ['Spaghetti, 1 lb', 1, 'lb'],
      ['Ground beef, 85/15', 1, 'lb'],
      ['Crushed tomatoes, 28 oz', 1, 'ea'],
      ['Yellow onions, 3 lb bag', 1, 'ea'],
      ['Garlic, head', 1, 'ea'],
    ],
  },
  {
    name: 'Roast salmon and greens',
    notes: '400F, twelve minutes, do not overthink it.',
    servings: 2,
    tags: ['quick'],
    timesCooked: 4,
    ingredients: [
      ['Salmon fillet', 1, 'lb'],
      ['Baby spinach, 5 oz', 1, 'ea'],
      ['Limes', 2, 'ea'],
      ['Olive oil', 2, 'tbsp'],
    ],
  },
  {
    name: 'Black bean tacos',
    notes: 'Vegetarian unless there is leftover chili.',
    servings: 2,
    tags: ['quick', 'vegetarian'],
    timesCooked: 6,
    ingredients: [
      ['Canned black beans', 2, 'ea'],
      ['Sharp cheddar, 8 oz', 1, 'ea'],
      ['Roma tomatoes', 3, 'ea'],
      ['Limes', 2, 'ea'],
      ['Scallions, bunch', 1, 'ea'],
    ],
  },
  {
    name: 'Chicken and rice soup',
    notes: 'Uses up whatever vegetables are going soft.',
    servings: 4,
    tags: ['batch cook'],
    timesCooked: 5,
    ingredients: [
      ['Chicken thighs, boneless', 1, 'lb'],
      ['Chicken stock, 32 oz', 2, 'ea'],
      ['Carrots, 1 lb', 1, 'lb'],
      ['Long grain rice, 2 lb', 1, 'cup'],
      ['Frozen peas, 16 oz', 1, 'ea', true],
    ],
  },
  {
    name: 'Bacon and egg hash',
    notes: 'Weekend breakfast.',
    servings: 2,
    tags: ['quick'],
    timesCooked: 8,
    ingredients: [
      ['Bacon, 12 oz', 1, 'ea'],
      ['Large eggs, dozen', 4, 'ea'],
      ['Russet potatoes, 5 lb', 2, 'lb'],
      ['Yellow onions, 3 lb bag', 1, 'ea'],
    ],
  },
  {
    name: 'Yogurt and berries',
    notes: 'Not really cooking.',
    servings: 2,
    tags: ['quick', 'vegetarian'],
    timesCooked: 15,
    ingredients: [
      ['Greek yogurt, 32 oz', 1, 'ea'],
      ['Frozen berries, 16 oz', 1, 'ea'],
    ],
  },
]

/** Three closed weeks: [budgetCents, actualTotalCents] */
const HISTORY: [number, number][] = [
  [15000, 16240], // over
  [15000, 13875], // under
  [15000, 14990], // just under
]

function buildSeed(now: number) {
  const tables = emptyTables()
  const itemIdByName = new Map<string, number>()

  const items: Item[] = ITEM_SPECS.map(([name, category, lastPaidCents, isStaple], index) => {
    const id = index + 1
    itemIdByName.set(name, id)
    return {
      id,
      name,
      normalizedName: name.toLowerCase().trim(),
      category,
      lastPaidCents,
      lastPurchasedAt: lastPaidCents === null ? null : addDays(now, -7),
      purchaseCount: lastPaidCents === null ? 0 : 1 + ((index * 3) % 9),
      isStaple: isStaple ?? false,
      isArchived: false,
    }
  })

  const meals: Meal[] = []
  const mealIngredients: MealIngredient[] = []
  let ingredientId = 1

  MEAL_SPECS.forEach((spec, index) => {
    const mealId = index + 1
    meals.push({
      id: mealId,
      name: spec.name,
      notes: spec.notes,
      servings: spec.servings,
      tags: spec.tags,
      timesCooked: spec.timesCooked,
      lastCookedAt: addDays(now, -(index * 4 + 3)),
    })
    for (const [itemName, quantity, unit, isOptional] of spec.ingredients) {
      const itemId = itemIdByName.get(itemName)
      if (itemId === undefined) throw new Error(`Seed references unknown item: ${itemName}`)
      mealIngredients.push({
        id: ingredientId++,
        mealId,
        itemId,
        quantity,
        unit,
        isOptional: isOptional ?? false,
      })
    }
  })

  const weeks: Week[] = []
  const plannedMeals: PlannedMeal[] = []
  const entries: Entry[] = []
  let plannedId = 1
  let entryId = 1

  const thisWeekStart = startOfWeek(now, DEFAULT_SETTINGS.weekStartDay)

  HISTORY.forEach(([budgetCents, actualTotalCents], index) => {
    const weekId = index + 1
    // Oldest first: three, two, then one week ago.
    const startDate = addDays(thisWeekStart, -7 * (HISTORY.length - index))
    weeks.push({
      id: weekId,
      startDate,
      budgetCents,
      actualTotalCents,
      isClosed: true,
      notes: '',
    })

    // Three dinners a week, rotating through the library.
    for (let day = 0; day < 3; day++) {
      const mealIndex = (index * 3 + day) % MEAL_SPECS.length
      plannedMeals.push({
        id: plannedId++,
        weekId,
        mealId: mealIndex + 1,
        freeformTitle: '',
        dayOffset: day * 2,
        slot: 'dinner',
        servingsMultiplier: 1,
      })
    }

    // A handful of checked-off entries so the closed week has a readable list.
    for (let i = 0; i < 6; i++) {
      const item = items[(index * 6 + i) % items.length]
      if (!item?.id) continue
      entries.push({
        id: entryId++,
        weekId,
        itemId: item.id,
        quantity: 1,
        unit: 'ea',
        estimatedCents: item.lastPaidCents,
        actualCents: null,
        isChecked: true,
        sortIndex: i,
        isFromMealPlan: i < 4,
        priceWasOverridden: false,
        contributingMealNames: i < 4 ? [MEAL_SPECS[(index + i) % MEAL_SPECS.length]!.name] : [],
      })
    }
  })

  tables.items = items
  tables.meals = meals
  tables.mealIngredients = mealIngredients
  tables.weeks = weeks
  tables.plannedMeals = plannedMeals
  tables.entries = entries
  tables.settings = [DEFAULT_SETTINGS]
  return tables
}

/** Replaces the database with sample data. Destructive, and dev-only. */
export async function seedDatabase(now: number = Date.now()): Promise<void> {
  await restoreBackup(buildSeed(now))
}
