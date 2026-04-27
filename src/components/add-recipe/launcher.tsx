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

  const handleOpen = () => {
    setOpen(true)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
  }

  return (
    <>
      <FloatingAddButton onClick={handleOpen} />
      <AddRecipeModal
        open={open}
        onOpenChange={handleOpenChange}
        onRecipeSaved={onRecipeSaved}
      />
    </>
  )
}
