'use client'

import { Loader2 } from 'lucide-react'

type Stage = 'fetching' | 'parsing' | 'structuring' | 'finding_image' | 'complete' | 'error'

const STAGE_LABELS: Record<Stage, string> = {
  fetching: 'Seite laden',
  parsing: 'Rezept erkennen',
  structuring: 'Rezept erkennen',
  finding_image: 'Bild suchen',
  complete: 'Fertig',
  error: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
}

type StreamingProgressProps = {
  stage: Stage
  streamText?: string
}

export function StreamingProgress({ stage, streamText }: StreamingProgressProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border/70 bg-card/60 p-4">
      <div className="flex items-center gap-3">
        {stage !== 'complete' && stage !== 'error' && (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
        <div className="space-y-1">
          <p className="text-base font-medium text-foreground">Rezept wird erkannt</p>
          <span className="text-sm text-muted-foreground">{STAGE_LABELS[stage]}</span>
        </div>
      </div>
      {streamText && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
          {streamText}
        </div>
      )}
    </div>
  )
}

export type { Stage }
