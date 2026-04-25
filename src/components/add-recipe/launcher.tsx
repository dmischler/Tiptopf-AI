'use client'

import { useState } from 'react'

import { FloatingAddButton } from '@/components/add-recipe/fab'
import { AddRecipeModal } from '@/components/add-recipe/modal'
import type { Recipe } from '@/types'

type AddRecipeLauncherProps = {
  onRecipeSaved?: (recipe: Recipe) => void
}

export function AddRecipeLauncher({ onRecipeSaved }: AddRecipeLauncherProps) {
  const [open, setOpen] = useState(false)
  const [initialUrl, setInitialUrl] = useState<string | undefined>(undefined)

  const handleOpen = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const trimmed = text.trim()

      if (trimmed.length > 500) {
        throw new Error('too long')
      }

      if (/^https?:\/\//i.test(trimmed)) {
        setInitialUrl(trimmed)
      }
    } catch {
      // Silent fallback: permission denied, non-HTTPS, empty clipboard, etc.
    }

    setOpen(true)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setInitialUrl(undefined) // Clear for next time
    }
  }

  return (
    <>
      <FloatingAddButton onClick={handleOpen} />
      <AddRecipeModal
        open={open}
        onOpenChange={handleOpenChange}
        onRecipeSaved={onRecipeSaved}
        initialUrl={initialUrl}
      />
    </>
  )
}
