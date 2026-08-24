import { useNavigate } from 'react-router-dom'

export default function Shop() {
  const navigate = useNavigate()
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white p-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="min-h-[44px] rounded-lg px-3 text-teal-700"
        >
          Done
        </button>
        <h1 className="text-lg font-semibold">Shopping</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none p-4">
        <p className="text-sm text-slate-500">Shopping mode — Phase 5.</p>
      </div>
    </div>
  )
}
