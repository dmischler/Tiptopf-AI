'use client'

import { useState } from 'react'

import { FloatingAddButton } from '@/components/add-recipe/fab'
import { AddRecipeModal } from '@/components/add-recipe/modal'

export function AddRecipeLauncher() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <FloatingAddButton onClick={() => setOpen(true)} />
      <AddRecipeModal open={open} onOpenChange={setOpen} />
    </>
  )
}
