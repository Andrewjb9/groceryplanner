# Weekly Grocery Budget & Meal Planner — Build Plan

A personal web app, installed to the iPhone home screen: plan the week's meals, generate a shopping list from them, keep it under budget, track what was actually spent.

**Personal use only.** No accounts, no onboarding, no multi-user, no analytics. One person, one device. Build only what I'll actually touch.

**This document is the spec.** Work through the phases in order. Do not start a phase until the previous phase's "Done when" criteria all pass. Ask before deviating from the decisions in "Locked Decisions."

---

## 1. The Problem

Every week I need to answer two questions at once: *what am I cooking?* and *can I afford it?* Right now those live in different places and neither informs the other.

The workflow I want:

1. Plan meals across the week — Monday chili, Tuesday leftovers, Wednesday stir fry.
2. The app pulls each meal's ingredients into one merged shopping list.
3. Because the app remembers what I paid for those ingredients last time, I see an **estimated total** immediately.
4. If it's over budget, I swap a meal and watch the number drop — *before* I've shopped.
5. In the store, I check items off with a running total visible.
6. Enter the receipt total. Prices update. Next week's estimate is sharper.

Two features carry the app: **meals generate the list**, and **the app remembers prices**. Everything else is support.

---

## 2. Locked Decisions

| Area | Decision | Why |
|---|---|---|
| Platform | Installable PWA, added to iPhone home screen from Safari | Dev machine is Windows; Xcode is macOS-only |
| Framework | React 18 + TypeScript + Vite | |
| Storage | IndexedDB via **Dexie**, with `dexie-react-hooks` `useLiveQuery` | Hand-rolling IndexedDB is a tarpit; liveQuery gives reactive reads for free |
| Styling | Tailwind CSS | |
| Routing | React Router, hash-free browser routing | Tab state in the URL; back button behaves |
| PWA shell | `vite-plugin-pwa` | Generates manifest + service worker; don't hand-write these |
| Charts | **None.** Hand-roll the 8-week bar chart with flexbox divs | It's ~20 lines. A chart library is not worth 40 kB here |
| Money | **Integer cents everywhere.** Never store or compute money as a float | `0.1 + 0.2 !== 0.3`. Format to currency only at the render boundary |
| Server | None. Fully client-side, static hosting | |
| Week boundary | Configurable start day, default Sunday | |
| Recipes | Ingredient list + free-text notes. **No structured steps, no timers, no photos, no URL import** | This is a planner, not a cookbook |
| Meal → list | Meals generate list entries; manual entries coexist and are never overwritten | Regeneration must be safe to run repeatedly |

**Approved dependencies, and only these:** `react`, `react-dom`, `react-router-dom`, `dexie`, `dexie-react-hooks`, `tailwindcss`, `vite`, `vite-plugin-pwa`, `typescript`, `vitest`. Adding anything else requires asking first.

---

## 3. Data Model

IndexedDB, so relationships are **numeric foreign keys**, not object references. Resolve them with explicit lookups. Do not attempt an ORM-style join layer.

All money fields are **integer cents** and named with a `Cents` suffix so a float can never sneak in unnoticed.

### `items` — the catalog
Things I buy. Persists across weeks; this is what makes price memory work.

```ts
{
  id: number
  name: string                    // "Whole milk, gallon"
  normalizedName: string          // lowercased + trimmed, used for dedupe on add
  category: Category              // 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen' | 'household' | 'other'
  lastPaidCents: number | null
  lastPurchasedAt: number | null  // epoch ms
  purchaseCount: number
  isStaple: boolean               // salt, oil — assumed on hand, excluded from generation
  isArchived: boolean
}
```

### `meals` — the recipe library
```ts
{
  id: number
  name: string
  notes: string                   // free text: loose method, links, reminders
  servings: number                // default 2
  tags: string[]                  // 'quick', 'vegetarian', 'batch cook'
  timesCooked: number
  lastCookedAt: number | null
}
```

### `mealIngredients` — joins a meal to a catalog item
```ts
{
  id: number
  mealId: number
  itemId: number
  quantity: number                // may be fractional (1.5 lb)
  unit: string                    // 'ea' | 'lb' | 'oz' | 'cup' | 'tbsp' — free text
  isOptional: boolean             // excluded from generation unless toggled on
}
```

### `weeks` — one budget period
```ts
{
  id: number
  startDate: number               // epoch ms, normalized to local midnight
  budgetCents: number
  actualTotalCents: number | null // null until the trip is closed out
  isClosed: boolean
  notes: string
}
```

### `plannedMeals` — a meal assigned to a slot
```ts
{
  id: number
  weekId: number
  mealId: number | null           // null for a freeform entry
  freeformTitle: string           // used when mealId is null: "leftovers", "out"
  dayOffset: number               // 0–6 from the week's startDate
  slot: 'breakfast' | 'lunch' | 'dinner' | 'other'
  servingsMultiplier: number      // default 1; cooking double scales ingredients
}
```
Default `slot` to `'dinner'` and **hide the picker unless tapped** — dinner is 90% of real use.

### `entries` — one line on one week's list
```ts
{
  id: number
  weekId: number
  itemId: number
  quantity: number
  unit: string
  estimatedCents: number | null   // snapshot of item.lastPaidCents at add time; user-overridable
  actualCents: number | null      // entered in shopping mode if the shelf price surprised me
  isChecked: boolean
  sortIndex: number
  isFromMealPlan: boolean         // CRITICAL: only these are touched by regeneration
  priceWasOverridden: boolean     // protects a manual price from being clobbered on regenerate
  contributingMealNames: string[] // so a row can show "chili, stir fry"
}
```

### `settings` — single row, `id: 1`
```ts
{
  id: 1
  weekStartDay: number            // 0 = Sunday
  defaultBudgetCents: number
  roundEstimatesUp: boolean       // default true; padding beats a nasty surprise
  excludeStaplesFromGeneration: boolean  // default true
}
```

**Derived values are computed, never stored.** Put them in `src/lib/totals.ts` as pure functions over an entry array:
- `estimatedTotalCents` = Σ `round(quantity × (actualCents ?? estimatedCents ?? 0))`
- `checkedTotalCents` = same, filtered to `isChecked`
- `remainingCents` = `budgetCents − checkedTotalCents`

Round **once**, at each line, not at the end. One source of truth for the math.

---

## 4. List Generation — the tricky part

Triggered by **Generate List** on the week's meal plan. Spec it carefully; this is where the bugs will live.

`generateEntries()` in `src/lib/generateList.ts` is a **pure function**: takes planned meals, meal ingredients, items, settings, and the existing entries; returns the new entry array. It performs **no database writes** — the caller applies the result. This is what makes it testable.

For every planned meal with a non-null `mealId`, walk its non-optional ingredients:

1. **Scale** each quantity by `servingsMultiplier`.
2. **Merge** by `itemId` + `unit`. Two meals each needing 1 lb chicken → one entry, 2 lb, `contributingMealNames: ['chili', 'stir fry']`.
3. **Unit mismatch** on the same item (1 lb vs. 8 oz) → emit two separate entries rather than guessing a conversion. **Do not build a unit-conversion system.**
4. **Skip staples** when `excludeStaplesFromGeneration` is on.
5. **Price** each entry from `item.lastPaidCents`. Unknown price → `estimatedCents: null`, excluded from the total, and surfaced as a visible count of unpriced items so the estimate is never *silently* wrong.

Regeneration rules — **generation must be safe to run repeatedly:**

- Remove existing entries where `isFromMealPlan === true` **and** `isChecked === false`, then rebuild.
- **Never** touch entries where `isFromMealPlan === false` — those are my manual additions.
- **Never** touch checked entries — I already put it in the cart.
- Entries with `priceWasOverridden === true` keep their `estimatedCents`; re-apply by `itemId` after rebuilding.

---

## 5. Screens

Bottom tab bar, four tabs — thumb reach matters more than screen real estate here.

### Tab 1 — Week
Segmented control at top: **Meals** | **List**. Two halves of one workflow.

**Meals segment**
- Seven day rows, today highlighted
- Each row: planned meal name, or an empty "+" slot
- Tap "+" → pick from the recipe library, or type a freeform title
- Tap a planned meal → servings multiplier, move to another day, remove
- Sticky bottom bar: **Generate List** with a preview count ("18 items · est. $84")

**List segment**
- Budget header: spent vs. budget, **remaining** in large type, unmissable over-budget state
- Entries grouped by category; row shows name, qty × unit, price, checkbox
- Meal-generated rows show a small caption of contributing meal names
- Banner when items are unpriced: "3 items have no price yet — estimate may be low"
- Swipe to delete, drag to reorder within category, "+" for quick add
- Header button: **Start Shopping**

### Shopping Mode (full-screen route, `/shop`)
- Large tap targets, one-handed use in an aisle
- Running total pinned to the bottom above the safe-area inset, always visible
- Tap a row to check it; long-press to enter an actual price that differed
- Quick add stays reachable — I always buy something not on the list
- Request a **screen wake lock** on entry, release on exit. Feature-detect it; degrade silently if unavailable.
- **Finish** → prompt for receipt total → write `actualTotalCents`, set `isClosed`, update `lastPaidCents` / `lastPurchasedAt` / `purchaseCount` on every checked item, increment `timesCooked` on each planned meal. **All of this in a single Dexie transaction** — a half-applied close is the worst possible state.

### Tab 2 — Recipes
- Searchable meal library, filterable by tag
- Detail: name, servings, ingredient rows (item + qty + unit + optional flag), notes
- Shows estimated cost per meal from current prices — genuinely useful for spotting expensive habits
- Sort by name, last cooked, or times cooked
- Add ingredient reuses the shared item picker

### Tab 3 — History
- Closed weeks: date range, budget, actual, over/under delta, color-coded
- Tap → read-only list **and** the meal plan for that week (this becomes the "what did I cook in March" archive)
- 8-week bar chart, actual vs. budget. Flexbox divs with percentage heights and a budget line. No library.

### Tab 4 — Items
- The catalog, searchable
- Row: last paid price, last purchased date, staple toggle
- Edit name, category, price; archive
- The escape hatch when a remembered price goes stale

### Item Picker (shared sheet — quick add *and* recipe editing)
- Search filters existing items live
- Results ordered by `purchaseCount` desc, then recency
- New name → "Add '<name>' as new item"
- Adding a duplicate bumps quantity instead of creating a second row

---

## 6. iOS PWA Requirements

These are not polish. Skip them and the app feels broken on the device.

- **Viewport:** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- **Safe areas:** the bottom tab bar and the shopping-mode total bar must pad with `env(safe-area-inset-bottom)`, or they sit under the home indicator
- **Use `dvh`, never `vh`** — `100vh` is wrong on iOS Safari whenever the toolbar is showing
- **Inputs must be ≥16px font-size** or iOS zooms the whole page on focus. This will happen on the price field and it is maddening.
- **`overscroll-behavior: none`** on scroll containers to kill rubber-band and pull-to-refresh
- **`user-select: none`** on tap targets — long-press otherwise pops the text-selection callout
- **Manifest:** `display: 'standalone'`, `theme_color`, `background_color`, plus a 180×180 `apple-touch-icon` (iOS ignores the manifest icons for the home screen)
- **Tap targets ≥44px.** Shopping mode is used one-handed, in motion, holding a basket.
- **No hover states as the only affordance** — there is no hover on a phone

---

## 7. Phases

Each phase ends with something that runs. Deploy at the end of Phase 0 so it's on the phone from day one and stays real.

### Phase 0 — Scaffold and deploy
Vite + React + TS + Tailwind. `vite-plugin-pwa` configured, manifest, icons. Bottom tab bar with four empty routes. Deploy to static hosting; install to home screen; confirm it opens fullscreen with no browser chrome.

```
src/
  db/          schema.ts (Dexie), seed.ts
  lib/         totals.ts, generateList.ts, money.ts, dates.ts, export.ts
  routes/      Week/, Shop/, Recipes/, History/, Items/
  components/  ItemPicker, BudgetHeader, TabBar, Sheet
  hooks/
```

**Done when:** it's an icon on my home screen that opens to an empty four-tab shell.

### Phase 1 — Data layer + export
Full Dexie schema with indexes. `money.ts` (parse to cents, format from cents) and `totals.ts`, both with Vitest tests. `seed.ts` with ~30 items, ~8 meals, 3 weeks of history, dev-only.

**Export ships now, not later.** Settings button dumps all tables to a JSON file and re-imports it. iOS can reclaim storage from web apps, and there's no cloud backup — losing a year of recipes to a storage eviction would end the project. This is the cheapest insurance available.

**Done when:** tests pass for money parsing/formatting and all four total computations including the empty case; export → wipe → import round-trips without loss.

### Phase 2 — Recipes tab
Meal library CRUD, ingredient editing, shared item picker, per-meal cost estimate.

**Done when:** I can build a real recipe from scratch and it shows a sensible estimated cost.

### Phase 3 — Meal plan + generation
Meals segment, day slots, freeform entries, servings multiplier, `generateList.ts`.

**Done when:** tests cover merging across meals, unit mismatch, staple exclusion, servings scaling, and all four regeneration guarantees (manual entries survive, checked entries survive, overridden prices survive, repeat runs are idempotent). Highest-risk phase — test it properly.

### Phase 4 — List + budget
List segment, budget header, manual add/edit/delete/reorder, unpriced-items banner. Week auto-creates on first load and rolls over at the boundary.

**Done when:** I can plan meals, generate, hand-add a few extras, regenerate, and confirm nothing I typed was lost.

### Phase 5 — Shopping mode
Route, running total, check-off, actual-price override, wake lock, transactional finish with price write-back.

**Done when:** completing a trip updates `lastPaidCents` on every checked item and next week's estimates reflect it.

### Phase 6 — History
History list, week detail with meal plan, hand-rolled bar chart.

**Done when:** three closed weeks render correctly and past meal plans are readable.

### Phase 7 — Polish
App icon, haptics where supported, "repeat last week's plan," settings screen, offline check (airplane mode, full cold start), empty states, larger-text check.

**Done when:** it survives a full real week without me reaching for Notes.

### Later (do not build in v1)
Cloud sync · pantry inventory · receipt OCR · sharing with a partner · meal suggestions from what's cheap

---

## 8. Hosting and Getting It On My Phone

A service worker requires HTTPS, so `localhost` alone won't do — the app needs a real URL before it can be installed.

- Push the repo to GitHub, connect it to a free static host (Netlify, Vercel, or Cloudflare Pages). Build command `npm run build`, output `dist`. Every push redeploys.
- On the iPhone, open the URL **in Safari**, tap Share → **Add to Home Screen**.
- Installing to the home screen is also what protects the stored data — Safari is aggressive about clearing storage for sites you merely visit. This is why export exists in Phase 1.
- The app is public at that URL. There's no login and no personal data beyond grocery prices, which is fine, but don't put anything sensitive in the notes fields.
- For local dev on the phone: `npm run dev -- --host` and hit the LAN address. Service worker and install won't work over plain HTTP, but everything else will.

---

## 9. Conventions

- Function components + hooks. No class components, no state management library — `useLiveQuery` is the state layer.
- Components under ~150 lines; extract rather than nest
- All DB reads go through `useLiveQuery`; all writes through helpers in `src/db/`, never inline in a component
- Money **never** leaves `money.ts` as anything but integer cents. Formatting happens at render, once.
- `generateList.ts` and `totals.ts` are pure and dependency-free — no Dexie imports in either
- Multi-table writes use `db.transaction`
- Tests with Vitest for money, dates/week boundaries, totals, and generation. No component tests in v1.
- Commit at the end of each phase with the phase number in the message

---

## 10. Open Questions

Resolve before Phase 3:

1. **"I already have that."** Some generated ingredients are already in the pantry. v1 assumption: mark items as staples to exclude permanently, swipe-delete anything else. A real pantry inventory is out of scope — revisit only if staples prove insufficient.
2. **Leftovers.** Planning Tuesday as "leftovers from Monday" shouldn't generate ingredients. Assumption: freeform entries never generate anything. Good enough?
3. **Unchecked items at week close.** Discard or roll to next week? Assumption: prompt once, default to rolling over.
4. **Receipt mismatch.** If the receipt total doesn't match the checked total, reconcile or store both? Assumption: store both, show the delta, don't chase it.
