'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

import { getStoreCorruptBackupPath, isStoreCorruptError } from '@/lib/local/errors'

function isRedactedServerErrorMessage(message: string) {
  return (
    message.includes('omitted in production') ||
    message.includes('An error occurred in the Server Components render')
  )
}

function storeCorruptMessage(error: Error & { digest?: string }) {
  const backupPath = getStoreCorruptBackupPath(error)

  if (error.message && !isRedactedServerErrorMessage(error.message)) {
    return error.message
  }

  if (backupPath) {
    return `Die Bibliothek-Datei ist beschädigt. Die Datei liegt unter ${backupPath}. Stelle ein Backup wieder her.`
  }

  return 'Die Bibliothek-Datei ist beschädigt. Die Datei liegt unter DATA_DIR (tiptopf.json.bak oder tiptopf.json.corrupt.*). Stelle ein Backup wieder her.'
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const storeCorrupt = isStoreCorruptError(error)

  useEffect(() => {
    console.error('App error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <AlertTriangle className="mb-4 h-10 w-10 text-destructive" />
      <h2 className="mb-2 text-xl font-semibold">
        {storeCorrupt ? 'Bibliothek beschädigt' : 'Etwas ist schiefgelaufen'}
      </h2>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">
        {storeCorrupt
          ? storeCorruptMessage(error)
          : error.message && !isRedactedServerErrorMessage(error.message)
            ? error.message
            : 'Ein unerwarteter Fehler ist aufgetreten.'}
      </p>
      {error.digest && !storeCorrupt && (
        <p className="mb-4 text-xs text-muted-foreground">Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Erneut versuchen
      </button>
    </div>
  )
}
