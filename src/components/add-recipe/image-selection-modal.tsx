'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { RecipeImageCandidate } from '@/lib/ai/image-types'

type ImageSelectionModalProps = {
  open: boolean
  loading: boolean
  title: string
  candidates: RecipeImageCandidate[]
  onOpenChange: (open: boolean) => void
  onSelectCandidate: (candidate: RecipeImageCandidate) => void
  onRefreshSearch: () => void
}

export function ImageSelectionModal({
  open,
  loading,
  title,
  candidates,
  onOpenChange,
  onSelectCandidate,
  onRefreshSearch,
}: ImageSelectionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6">
          <DialogTitle>Rezeptbild wählen</DialogTitle>
          <DialogDescription>
            Suchergebnisse für <span className="font-medium text-foreground">{title}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Passende Bilder werden gesucht...
            </div>
          ) : candidates.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="group overflow-hidden rounded-xl border border-border/70 bg-card text-left transition hover:border-border hover:shadow-md"
                  onClick={() => onSelectCandidate(candidate)}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={candidate.thumbnailUrl || candidate.url}
                      alt={candidate.alt || 'Rezeptbild'}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="space-y-1 px-3 py-2 text-xs text-muted-foreground">
                    <div className="line-clamp-1 text-sm font-medium text-foreground">
                      {candidate.alt || 'Rezeptbild'}
                    </div>
                    <div>Quelle: {candidate.source}</div>
                    {candidate.creditName ? <div>Foto von {candidate.creditName}</div> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-6 text-sm text-muted-foreground">
              Keine Treffer. Du kannst die Suche wiederholen.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
            <Button type="button" variant="outline" onClick={onRefreshSearch} disabled={loading}>
              Erneut suchen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
