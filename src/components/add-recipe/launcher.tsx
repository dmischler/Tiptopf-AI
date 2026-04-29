'use client'

import { useState } from 'react'

import { AddRecipeModal } from '@/components/add-recipe/modal'
import type { Recipe } from '@/types'

type AddRecipeLauncherProps = {
  onRecipeSaved?: (recipe: Recipe) => void
  initialMode?: 'image' | 'url' | 'manual'
  allTags?: string[]
}

export function AddRecipeLauncher({ onRecipeSaved, initialMode, allTags }: AddRecipeLauncherProps) {
  const [open, setOpen] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
  }

  return (
    <AddRecipeModal
      open={open}
      onOpenChange={handleOpenChange}
      onRecipeSaved={onRecipeSaved}
      initialMode={initialMode}
      allTags={allTags}
    />
  )
}
