import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBackup } from '../../hooks/useBackup'
import { seedDatabase } from '../../db/seed'

const BUTTON = 'min-h-[44px] w-full rounded-xl px-4 py-3 text-left text-base font-medium'
const PRIMARY = `${BUTTON} bg-teal-700 text-white`
const SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900`
const DANGER = `${BUTTON} border border-red-300 bg-white text-red-700`

export default function Settings() {
  const navigate = useNavigate()
  const { status, setStatus, exportBackup, copyBackup, importText, importFile, wipe } = useBackup()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pasted, setPasted] = useState('')

  const busy = status.kind === 'busy'

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-1 border-b border-slate-200 bg-white p-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-[44px] rounded-lg px-3 text-base text-teal-700"
        >
          Back
        </button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {status.kind !== 'idle' && status.kind !== 'busy' && (
          <p
            role="status"
            className={`rounded-xl p-3 text-sm ${
              status.kind === 'error'
                ? 'bg-red-50 text-red-800'
                : 'bg-teal-50 text-teal-900'
            }`}
          >
            {status.message}
          </p>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 uppercase">Backup</h2>
          <p className="text-sm text-slate-600">
            There is no cloud copy of any of this. iOS can reclaim storage from web apps, so export
            regularly and keep the file somewhere else.
          </p>
          <button type="button" className={PRIMARY} onClick={exportBackup} disabled={busy}>
            Export backup
          </button>
          <button type="button" className={SECONDARY} onClick={copyBackup} disabled={busy}>
            Copy backup to clipboard
          </button>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 uppercase">Restore</h2>
          <p className="text-sm text-slate-600">
            Restoring replaces everything currently stored. You&rsquo;ll be asked to confirm first.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void importFile(file)
            }}
          />
          <button
            type="button"
            className={SECONDARY}
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            Choose a backup file
          </button>
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder="…or paste backup JSON here"
            rows={4}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono"
          />
          <button
            type="button"
            className={SECONDARY}
            disabled={busy || pasted.trim() === ''}
            onClick={() => void importText(pasted)}
          >
            Restore from pasted text
          </button>
        </section>

        {import.meta.env.DEV && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-500 uppercase">Developer</h2>
            <button
              type="button"
              className={SECONDARY}
              disabled={busy}
              onClick={() => {
                setStatus({ kind: 'busy' })
                void seedDatabase()
                  .then(() => setStatus({ kind: 'ok', message: 'Seeded sample data.' }))
                  .catch((error: unknown) =>
                    setStatus({ kind: 'error', message: String(error) }),
                  )
              }}
            >
              Load sample data
            </button>
            <button type="button" className={DANGER} onClick={wipe} disabled={busy}>
              Wipe database
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
