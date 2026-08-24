import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Week', glyph: '🗓' },
  { to: '/recipes', label: 'Recipes', glyph: '🍲' },
  { to: '/history', label: 'History', glyph: '📊' },
  { to: '/items', label: 'Items', glyph: '🧺' },
] as const

export default function TabBar() {
  return (
    <nav className="border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="flex">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                [
                  'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  isActive ? 'text-teal-700' : 'text-slate-500',
                ].join(' ')
              }
            >
              <span aria-hidden className="text-xl leading-none">
                {tab.glyph}
              </span>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
