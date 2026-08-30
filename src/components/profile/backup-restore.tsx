'use client'

import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { exportStoreAction, importStoreAction } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'

const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export function BackupRestoreSection() {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [exportIncludeSecrets, setExportIncludeSecrets] = useState(false)
  const [importIncludeSecrets, setImportIncludeSecrets] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    if (exportIncludeSecrets) {
      const confirmed = window.confirm(
        'Achtung: Dieses Backup enthält deine API-Keys im Klartext. Speichere die Datei nicht ungesichert. Fortfahren?'
      )
      if (!confirmed) {
        return
      }
    }

    setIsExporting(true)
    try {
      const json = await exportStoreAction({ includeSecrets: exportIncludeSecrets })
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `tiptopf-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success('Backup heruntergeladen.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export fehlgeschlagen.'
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleFileSelect(file: File) {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      toast.error('Bitte eine JSON-Datei auswählen.')
      return
    }

    if (file.size > MAX_IMPORT_BYTES) {
      toast.error('Backup ist zu groß (max. 5 MB).')
      return
    }

    const confirmed = window.confirm('Dies ersetzt alle Rezepte. Fortfahren?')
    if (!confirmed) {
      return
    }

    setIsImporting(true)
    try {
      const text = await file.text()
      if (text.length > MAX_IMPORT_BYTES) {
        toast.error('Backup ist zu groß (max. 5 MB).')
        return
      }
      await importStoreAction(text, { includeSecrets: importIncludeSecrets })
      toast.success('Backup erfolgreich wiederhergestellt. Seite wird neu geladen...')
      window.location.reload()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import fehlgeschlagen.'
      toast.error(message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Daten-Backup</h2>
      <p className="text-sm text-muted-foreground">
        Erstelle ein Backup deiner Rezeptbibliothek oder stelle ein früheres Backup wieder her.
        Standardmäßig enthalten Backups keine API-Keys.
      </p>

      <label className="flex min-h-[44px] items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-primary"
          checked={exportIncludeSecrets}
          onChange={(event) => setExportIncludeSecrets(event.target.checked)}
        />
        <span>
          Backup inklusive API-Keys. Achtung: Die Datei enthält dann deine Keys im Klartext.
        </span>
      </label>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleExport()}
          disabled={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exportiere...' : 'Backup herunterladen'}
        </Button>

        <label className="inline-flex">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="application/json,.json"
            disabled={isImporting}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleFileSelect(file)
              }
              event.currentTarget.value = ''
            }}
          />
          <span className="inline-flex h-9 min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border bg-background/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50">
            <Upload className="h-4 w-4" />
            {isImporting ? 'Importiere...' : 'Backup wiederherstellen'}
          </span>
        </label>
      </div>

      <label className="flex min-h-[44px] items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-primary"
          checked={importIncludeSecrets}
          onChange={(event) => setImportIncludeSecrets(event.target.checked)}
        />
        <span>
          Keys aus Backup übernehmen. Ohne diesen Haken bleiben deine aktuellen API-Keys erhalten.
        </span>
      </label>
    </section>
  )
}
