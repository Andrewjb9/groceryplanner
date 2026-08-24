import { useCallback, useState } from 'react'
import { readBackup, restoreBackup, wipeAll } from '../db/backup'
import { backupCounts, backupFilename, parseBackup, serializeBackup, totalRows } from '../lib/export'

export type BackupStatus =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string }

/**
 * Hands the JSON to the operating system.
 *
 * The share sheet is tried first because it is the only path that reliably
 * works in a standalone home-screen PWA -- iOS Safari will happily ignore an
 * `<a download>` click there, which would make the backup a silent no-op
 * exactly where it matters most. The download link is the desktop path.
 */
async function deliver(json: string, filename: string): Promise<string> {
  const file = new File([json], filename, { type: 'application/json' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Grocery backup' })
    return 'Shared. Save it somewhere off this device.'
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    // Give the browser a moment to start the download before dropping the blob.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  return `Downloaded ${filename}.`
}

export function useBackup() {
  const [status, setStatus] = useState<BackupStatus>({ kind: 'idle' })

  const run = useCallback(async (work: () => Promise<string>) => {
    setStatus({ kind: 'busy' })
    try {
      setStatus({ kind: 'ok', message: await work() })
    } catch (error) {
      // A cancelled share sheet is a normal outcome, not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus({ kind: 'idle' })
        return
      }
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  const exportBackup = useCallback(
    () =>
      run(async () => {
        const tables = await readBackup()
        const exportedAt = Date.now()
        return deliver(serializeBackup(tables, exportedAt), backupFilename(exportedAt))
      }),
    [run],
  )

  const copyBackup = useCallback(
    () =>
      run(async () => {
        const tables = await readBackup()
        await navigator.clipboard.writeText(serializeBackup(tables))
        return `Copied ${totalRows(tables)} rows to the clipboard.`
      }),
    [run],
  )

  /** `source` is lazy so that a failed file read is caught alongside everything else. */
  const applyBackup = useCallback(
    (source: () => Promise<string>) =>
      run(async () => {
        // Validate before touching the database, so a bad file cannot leave a
        // half-wiped state behind.
        const result = parseBackup(await source())
        if (!result.ok) throw new Error(result.error)

        const counts = backupCounts(result.backup.tables)
        const summary = Object.entries(counts)
          .filter(([, count]) => count > 0)
          .map(([name, count]) => `${count} ${name}`)
          .join(', ')

        const confirmed = window.confirm(
          `Replace everything currently stored with this backup?\n\n` +
            `${summary || 'an empty database'}\n\n` +
            `This cannot be undone.`,
        )
        if (!confirmed) return 'Import cancelled. Nothing changed.'

        await restoreBackup(result.backup.tables)
        return `Restored ${totalRows(result.backup.tables)} rows.`
      }),
    [run],
  )

  const importText = useCallback(
    (json: string) => applyBackup(async () => json),
    [applyBackup],
  )

  const importFile = useCallback(
    (file: File) => applyBackup(() => file.text()),
    [applyBackup],
  )

  const wipe = useCallback(
    () =>
      run(async () => {
        if (!window.confirm('Erase everything stored on this device?')) {
          return 'Wipe cancelled. Nothing changed.'
        }
        await wipeAll()
        return 'Database wiped.'
      }),
    [run],
  )

  return { status, setStatus, exportBackup, copyBackup, importText, importFile, wipe }
}
