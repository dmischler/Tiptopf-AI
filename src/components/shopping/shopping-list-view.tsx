'use client'

import { useState } from 'react'
import { Check, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  addManualItemAction,
  clearShoppingListAction,
  removeShoppingListItemAction,
  toggleShoppingListItemAction,
} from '@/app/actions/shopping-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ShoppingListItem } from '@/types'

interface ShoppingListViewProps {
  initialItems: ShoppingListItem[]
}

type Group = {
  key: string
  title: string
  servings?: number
  items: ShoppingListItem[]
}

function groupItems(items: ShoppingListItem[]): Group[] {
  const groups = new Map<string, Group>()

  for (const item of items) {
    const key = item.sourceRecipeTitle
      ? `recipe:${item.sourceRecipeTitle}:${item.sourceServings ?? ''}`
      : 'manual'

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: item.sourceRecipeTitle ?? 'Manuell hinzugefügt',
        servings: item.sourceServings,
        items: [],
      })
    }

    groups.get(key)!.items.push(item)
  }

  // Order: recipe groups first (in insertion order of first item), then manual
  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === 'manual') return 1
    if (b.key === 'manual') return -1
    return 0
  })
}

export function ShoppingListView({ initialItems }: ShoppingListViewProps) {
  const [items, setItems] = useState<ShoppingListItem[]>(initialItems)
  const [manualText, setManualText] = useState('')
  const [isAddingManual, setIsAddingManual] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  const checkedCount = items.filter((i) => i.checked).length
  const totalCount = items.length

  const groups = groupItems(items)

  async function handleToggle(item: ShoppingListItem) {
    const newChecked = !item.checked

    // Optimistic
    setItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i)),
    )

    try {
      await toggleShoppingListItemAction(item.id, newChecked)
    } catch (error) {
      // Revert
      setItems((current) =>
        current.map((i) => (i.id === item.id ? { ...i, checked: item.checked } : i)),
      )
      const message = error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'
      toast.error(message)
    }
  }

  async function handleAddManual() {
    const text = manualText.trim()
    if (!text) return

    setIsAddingManual(true)
    const optimisticItem: ShoppingListItem = {
      id: `temp-${Date.now()}`,
      text,
      checked: false,
      addedAt: new Date().toISOString(),
    }

    setItems((current) => [...current, optimisticItem])
    setManualText('')

    try {
      await addManualItemAction(text)
      // The server will revalidate; we can keep optimistic or refetch, but for simplicity we leave it
      // (next navigation will have fresh data)
    } catch (error) {
      // Remove optimistic
      setItems((current) => current.filter((i) => i.id !== optimisticItem.id))
      setManualText(text)
      const message = error instanceof Error ? error.message : 'Hinzufügen fehlgeschlagen.'
      toast.error(message)
    } finally {
      setIsAddingManual(false)
    }
  }

  async function handleClear() {
    if (items.length === 0) return

    setIsClearing(true)
    const previous = items
    setItems([])

    try {
      await clearShoppingListAction()
      toast.success('Einkaufsliste geleert.')
    } catch (error) {
      setItems(previous)
      const message = error instanceof Error ? error.message : 'Leeren fehlgeschlagen.'
      toast.error(message)
    } finally {
      setIsClearing(false)
    }
  }

  async function handleRemoveItem(itemId: string) {
    const previous = items
    setItems((current) => current.filter((i) => i.id !== itemId))

    try {
      await removeShoppingListItemAction(itemId)
    } catch (error) {
      setItems(previous)
      const message = error instanceof Error ? error.message : 'Entfernen fehlgeschlagen.'
      toast.error(message)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))] md:pb-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-semibold tracking-tight">Einkaufsliste</h1>
        </div>
        {totalCount > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleClear()}
            disabled={isClearing}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Liste leeren
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {checkedCount} / {totalCount} erledigt
        </span>
        <span className="text-xs">Angehakte wandern ans Ende</span>
      </div>

      {/* Manual add row */}
      <div className="flex gap-2">
        <Input
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Zutat manuell hinzufügen (z. B. 1 l Milch)"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isAddingManual) {
              void handleAddManual()
            }
          }}
          disabled={isAddingManual}
        />
        <Button
          onClick={() => void handleAddManual()}
          disabled={isAddingManual || !manualText.trim()}
        >
          {isAddingManual ? (
            '...'
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" /> Hinzufügen
            </>
          )}
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">Noch keine Einträge</p>
            <p className="text-sm text-muted-foreground">
              Füge Zutaten aus einem Rezept hinzu oder gib sie manuell ein.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
                {group.servings ? <span className="font-normal">({group.servings} Port.)</span> : null}
              </div>

              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-3 active:bg-muted/50"
                  >
                    <button
                      type="button"
                      onClick={() => void handleToggle(item)}
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-all active:scale-95",
                        item.checked
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-muted-foreground/60 bg-background hover:border-muted-foreground/90 active:bg-muted/40"
                      )}
                      aria-label={item.checked ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
                    >
                      {item.checked ? <Check className="h-4 w-4" /> : null}
                    </button>

                    <span
                      className={`flex-1 text-sm leading-relaxed ${
                        item.checked ? 'text-muted-foreground line-through' : ''
                      }`}
                    >
                      {item.text}
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleRemoveItem(item.id)}
                      className="ml-2 text-muted-foreground hover:text-destructive"
                      aria-label="Eintrag entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="h-4" />
    </main>
  )
}
