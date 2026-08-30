'use client'

import { Minus, Plus, UtensilsCrossed } from 'lucide-react'

import { Button } from '@/components/ui/button'

type ServingsStepperProps = {
  baseServings: number
  value: number
  onChange: (next: number) => void
}

export function ServingsStepper({ baseServings, value, onChange }: ServingsStepperProps) {
  const scaled = value !== baseServings

  return (
    <div className="flex items-center gap-1 text-sm font-medium">
      <UtensilsCrossed className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        data-print-hide
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Eine Portion weniger"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      {scaled ? (
        <button
          type="button"
          className="inline-flex min-h-[44px] min-w-[2.75rem] items-center justify-center gap-0.5 rounded-lg tabular-nums text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 touch-manipulation"
          onClick={() => onChange(baseServings)}
          aria-label={`Auf ${baseServings} Portionen zurücksetzen`}
          title={`Auf ${baseServings} Portionen zurücksetzen`}
        >
          {value}
          <span aria-hidden="true" className="text-xs text-primary/80">
            *
          </span>
        </button>
      ) : (
        <span className="min-w-[1.5rem] text-center tabular-nums">{value}</span>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        data-print-hide
        disabled={value >= 99}
        onClick={() => onChange(Math.min(99, value + 1))}
        aria-label="Eine Portion mehr"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
