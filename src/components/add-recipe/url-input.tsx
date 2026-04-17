'use client'

import { Link2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type UrlInputProps = {
  value: string
  disabled?: boolean
  onValueChange: (value: string) => void
  onExtract: () => Promise<void> | void
}

export function UrlInput({ value, disabled, onValueChange, onExtract }: UrlInputProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="recipe-url">Recipe URL</Label>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="recipe-url"
            type="url"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="https://example.com/recipe"
            className="pl-9"
            disabled={disabled}
          />
        </div>
      </div>

      <Button type="button" onClick={() => void onExtract()} disabled={disabled || !value.trim()}>
        Extract recipe
      </Button>
    </div>
  )
}
