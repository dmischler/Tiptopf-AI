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

  return (
    <>
      <FloatingAddButton onClick={() => setOpen(true)} />
      <AddRecipeModal open={open} onOpenChange={setOpen} onRecipeSaved={onRecipeSaved} />
    </>
  )
}
