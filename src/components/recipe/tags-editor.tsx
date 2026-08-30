'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeTags } from '@/lib/utils'

type TagsEditorProps = {
  tags: string[]
  allTags: string[]
  disabled?: boolean
  onChange: (tags: string[]) => void
}

export function TagsEditor({ tags, allTags, disabled, onChange }: TagsEditorProps) {
  const [tagInput, setTagInput] = useState('')
  const normalizedInput = tagInput.trim().toLowerCase()
  const suggestions =
    normalizedInput.length === 0
      ? []
      : allTags
          .filter((tag) => tag.startsWith(normalizedInput))
          .filter((tag) => !tags.includes(tag))
          .slice(0, 6)

  function addTag(raw: string) {
    const normalized = normalizeTags([raw])[0]
    if (normalized && !tags.includes(normalized)) {
      onChange([...tags, normalized])
    }
  }

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((item) => item !== tag))}
              className="ml-0.5 text-zinc-500 hover:text-zinc-200"
              disabled={disabled}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={tagInput}
            disabled={disabled}
            placeholder="Tag eingeben..."
            className="bg-background/70"
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                if (normalizedInput) {
                  addTag(normalizedInput)
                  setTagInput('')
                }
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !normalizedInput}
            onClick={() => {
              addTag(normalizedInput)
              setTagInput('')
            }}
          >
            Hinzufügen
          </Button>
        </div>
        {suggestions.length > 0 ? (
          <div className="absolute top-[calc(100%+0.4rem)] left-0 z-20 w-full rounded-lg border border-border/70 bg-popover p-1 shadow-lg">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => {
                  addTag(tag)
                  setTagInput('')
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
