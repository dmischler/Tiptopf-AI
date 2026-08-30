'use client'

import { ImagePicker } from '@/components/recipe/image-picker'
import { RecipeFields, type RecipeFieldsValue } from '@/components/recipe/recipe-fields'
import { Button } from '@/components/ui/button'
import type { ParsedRecipe } from '@/types'

export type EditableRecipePreview = RecipeFieldsValue & {
  sourceUrl: string | null
  sourceType: 'image' | 'url'
}

type RecipePreviewProps = {
  parsedRecipe: ParsedRecipe
  value: EditableRecipePreview
  disabled?: boolean
  imageCreditName?: string | null
  imageCreditUrl?: string | null
  allTags?: string[]
  onChange: (next: EditableRecipePreview) => void
  onSave: () => Promise<void> | void
  onCancel: () => void
  onImageFileChange?: (file: File | null) => void
}

export function RecipePreview({
  parsedRecipe,
  value,
  disabled,
  imageCreditName,
  imageCreditUrl,
  allTags = [],
  onChange,
  onSave,
  onCancel,
  onImageFileChange,
}: RecipePreviewProps) {
  function update(patch: Partial<RecipeFieldsValue>) {
    onChange({
      ...value,
      ...patch,
    })
  }

  return (
    <div className="space-y-5">
      {parsedRecipe.untranslated ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          Nicht übersetzt — API-Key im Profil fehlt.
        </div>
      ) : null}

      <ImagePicker
        title={value.title}
        category={value.category}
        imageUrl={value.imageUrl}
        disabled={disabled}
        creditName={imageCreditName}
        creditUrl={imageCreditUrl}
        onImageUrlChange={(imageUrl) => update({ imageUrl })}
        onFileChange={onImageFileChange}
      />

      <RecipeFields
        value={value}
        onChange={update}
        allTags={allTags}
        disabled={disabled}
        showNotes={false}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <span>Quelle: {value.sourceType}</span>
        {value.sourceUrl ? (
          <a href={value.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Quell-URL öffnen
          </a>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
          Verwerfen
        </Button>
        <Button type="button" onClick={() => void onSave()} disabled={disabled || !value.title.trim()}>
          In Bibliothek speichern
        </Button>
      </div>
    </div>
  )
}
