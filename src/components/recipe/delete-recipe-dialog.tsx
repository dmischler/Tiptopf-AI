'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type DeleteRecipeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isDeleting?: boolean
}

export function DeleteRecipeDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteRecipeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
          <DialogTitle>Rezept löschen?</DialogTitle>
          <DialogDescription>
            Rezept in den Papierkorb. Du kannst es kurz rückgängig machen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Abbrechen
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Löschen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
