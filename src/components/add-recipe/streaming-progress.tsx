'use client'

import { Loader2 } from 'lucide-react'

type Stage = 'fetching' | 'parsing' | 'structuring' | 'complete' | 'error'

const STAGE_LABELS: Record<Stage, string> = {
  fetching: 'Fetching recipe content...',
  parsing: 'AI is reading the recipe...',
  structuring: 'Structuring ingredients and steps...',
  complete: 'Recipe extracted!',
  error: 'Something went wrong. Please try again.',
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
        <span className="text-sm text-foreground">{STAGE_LABELS[stage]}</span>
      </div>
      {streamText && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background/70 p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
          {streamText}
        </div>
      )}
    </div>
  )
}

export type { Stage }
