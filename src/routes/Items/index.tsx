import { Link } from 'react-router-dom'

export default function Items() {
  return (
    <section>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white p-2 pl-4">
        <h1 className="text-2xl font-semibold tracking-tight">Items</h1>
        <Link
          to="/settings"
          aria-label="Settings"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-xl"
        >
          <span aria-hidden>⚙️</span>
        </Link>
      </header>
      <p className="p-4 text-sm text-slate-500">
        Item catalog and remembered prices — Phase 1 data layer is in; the catalog UI lands with the
        later phases.
      </p>
    </section>
  )
}
