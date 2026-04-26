'use client'

import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { exportStoreAction, importStoreAction } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'

export function BackupRestoreSection() {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setIsExporting(true)
    try {
      const json = await exportStoreAction()
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

    setIsImporting(true)
    try {
      const text = await file.text()
      await importStoreAction(text)
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
        Erstelle ein Backup deiner gesamten Rezeptbibliothek oder stelle ein früheres Backup wieder her.
      </p>

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
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50">
            <Upload className="h-4 w-4" />
            {isImporting ? 'Importiere...' : 'Backup wiederherstellen'}
          </span>
        </label>
      </div>
    </section>
  )
}
