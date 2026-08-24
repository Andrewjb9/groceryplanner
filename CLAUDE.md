# CLAUDE.md

Personal weekly grocery budget and meal planner. React PWA, installed to an iPhone home screen.

**The full spec is `plan.md` in this directory. Read it before starting work.** This file covers only how to work in this repo.

---

## Current phase

**Phase 0 — Scaffold and deploy.**

Work on one phase at a time. Do not start the next phase until the current phase's "Done when" criteria in `plan.md` pass. When a phase is finished, update the line above and commit.

---

## Environment

- **OS: Windows. Shell: PowerShell.** Not bash.
- Node 20+, npm
- Target device: iPhone, Safari, installed to home screen

## Running commands

These rules exist because violating them hangs the session. There is no way for you to answer an interactive prompt.

- **Never use `npx`.** If the package isn't installed locally it stops and asks "Ok to proceed? (y)" and waits forever. Use npm scripts, which resolve local binaries directly.
- **Never run long-lived processes** — `npm run dev`, `vite preview`, watch modes, anything that doesn't exit on its own. Print the command and I'll run it in my own terminal.
- **Never run interactive scaffolders** — `npm create vite`, `npm init` without `-y`. They ask questions. Tell me what to run instead.
- **No Unix tools.** `head`, `tail`, `grep`, `cat`, `&&` chaining are not available in PowerShell. If output is long, just let it be long.
- To verify your work: `npm run typecheck`, then `npm run test`. Run both after every meaningful change.

Required scripts in `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
}
```

## Dependencies

Approved, and only these:

`react` · `react-dom` · `react-router-dom` · `dexie` · `dexie-react-hooks` · `tailwindcss` · `vite` · `vite-plugin-pwa` · `typescript` · `vitest`

**Ask before installing anything else.** Specifically: no date library (`Date` and a few helpers in `src/lib/dates.ts` are enough), no chart library (the history chart is hand-rolled flexbox divs), no state management library (`useLiveQuery` is the state layer), no UI component library.

---

## Non-negotiable code rules

**1. Money is integer cents. Always.**
Never store, compute, or pass money as a float. Every money field and variable ends in `Cents`. Parsing and formatting live in `src/lib/money.ts` and happen only at the input and render boundaries. `0.1 + 0.2 !== 0.3` is exactly the bug that makes a budget app quietly wrong.

**2. `generateList.ts` and `totals.ts` are pure.**
No Dexie imports, no side effects, no DB writes. They take data in and return data out. The caller applies the result. This is what makes them testable, and list generation is the highest-risk logic in the app.

**3. Multi-table writes go in a `db.transaction`.**
Closing out a shopping trip touches four tables. A half-applied close is the worst state the app can be in.

**4. Regeneration must never destroy my input.**
Entries with `isFromMealPlan === false`, entries with `isChecked === true`, and prices with `priceWasOverridden === true` survive every regeneration. See §4 of `plan.md`. Cover all four guarantees with tests.

---

## Conventions

- Function components and hooks. No class components.
- All DB reads through `useLiveQuery`. All writes through helpers in `src/db/` — never inline in a component.
- Components under ~150 lines. Extract rather than nest.
- Tests (Vitest) for money, dates and week boundaries, totals, and list generation. No component tests in v1.
- Prefer editing existing files over creating new ones. Don't add files that `plan.md`'s structure doesn't call for without asking.

## iOS constraints that are easy to forget

Full list in §6 of `plan.md`. The ones that break things silently:

- Inputs must be **≥16px font-size** or iOS zooms the page on focus
- Use `dvh`, never `vh`
- Bottom bars need `env(safe-area-inset-bottom)` padding
- Tap targets ≥44px — shopping mode is used one-handed while holding a basket
- No hover-only affordances

---

## Working style

- Use plan mode for anything spanning more than two files. Phase 3 especially.
- Ask before deviating from a decision in `plan.md` §2. If a locked decision seems wrong, say so — don't silently work around it.
- Commit at the end of each phase, with the phase number in the message.
- I can't see your terminal. If something needs my eyes — the app in a browser, a device check — say so explicitly.
