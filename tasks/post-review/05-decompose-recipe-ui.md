# Phase 05 — Decompose recipe UI (one form, one picker, one labels module)

**Status:** COMPLETED  
**Depends on:** 04 (recipe is already a page; we split the page modules, not the dialog)  
**Goal:** No 1000+ line UI file. Add / manual / edit share one fields component. Labels and image picking exist in one place.

---

## Why

Even after Phase 04, the view/edit code will be a large paste. Three implementations of the same form exist today:

| Surface | File | Notes |
|---|---|---|
| AI preview | `add-recipe/preview.tsx` ~412 | No prep/cook fields; save uses `extractedRecipe.prep_time` (`modal.tsx:348-353`) |
| Manual | `add-recipe/manual-form.tsx` ~457 | 10MB image vs 5MB upload |
| Detail edit | `recipe-detail.tsx` ~1020–1458 | Fullest form |

Tags editors copied three times. Image candidate search copied in `modal.tsx`, `manual-form.tsx`, `recipe-detail.tsx`. `CATEGORY_LABELS` copied in card, detail, preview; filter uses **Leicht** vs **Einfach**.

`AddRecipeLauncher` is unused. Image picker toast promises AI generation that does not exist.

---

## Target module graph

```
src/lib/recipe-meta.ts          // labels, colors, enums, formatTotalTime
src/lib/recipe-schema.ts        // zod used by actions + optional client

src/components/recipe/
  tags-editor.tsx               // add/remove + autocomplete
  image-picker.tsx              // upload + pexels/mealdb grid + apply callback
  recipe-fields.tsx             // title, category, difficulty, times, servings, ingredients, instructions, notes, tags
  servings-stepper.tsx          // 44px +/−, tap scaled number to reset (keep existing behavior)
  recipe-ingredients.tsx        // scaled list for VIEW
  recipe-instructions.tsx       // numbered steps for VIEW
  recipe-notes.tsx              // escaped markdown-ish HTML
  add-to-collection-dialog.tsx
  delete-recipe-dialog.tsx

src/components/library/
  recipe-view.tsx               // composes view pieces + actions
  recipe-card.tsx               // imports labels from recipe-meta
  recipe-edit-form.tsx          // RecipeFields + save wiring for /library/[id]/edit

src/components/add-recipe/
  modal.tsx                     // host only: tabs, extract, then RecipeFields/preview
  preview.tsx                   // thin wrapper around RecipeFields
  manual-form.tsx               // thin wrapper around RecipeFields
  image-upload.tsx              // camera + file; used by image-picker
  expandable-fab.tsx
  streaming-progress.tsx        // rename copy only (Phase 06)
```

`recipe-detail.tsx` must be **deleted** by the end of this phase.

No file in `src/components/` should exceed ~400 lines without a reason written in the PR. None should cross 1000.

---

## 1. `src/lib/recipe-meta.ts`

Single source:

```ts
export const CATEGORIES: RecipeCategory[]
export const DIFFICULTIES: Difficulty[]

export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  starter: 'Vorspeise',
  main: 'Hauptgericht',
  dessert: 'Dessert',
  side: 'Beilage',
  breakfast: 'Frühstück',
  snack: 'Snack',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Einfach',   // NOT Leicht
  medium: 'Mittel',
  hard: 'Schwer',
}

export const CATEGORY_CLASS: Record<RecipeCategory, string>
export const CATEGORY_CHIP_CLASS: Record<RecipeCategory, string> // filter bar borders

export function formatTotalTime(prep: number, cook: number): string
  // German: "Keine Zeitangabe" instead of "No time set"
```

Replace all copies. Filter bar difficulty chips use `DIFFICULTY_LABELS`.

`src/lib/export.ts` currently has its own labels — import these.

---

## 2. `RecipeFields`

One controlled component:

```ts
type RecipeFieldsValue = {
  title: string
  category: RecipeCategory
  difficulty: Difficulty
  prepTime: string | number | null
  cookTime: string | number | null
  servings: string | number | null
  ingredientsText: string
  instructionsText: string
  notes: string
  tags: string[]
  imageUrl: string | null
}

type RecipeFieldsProps = {
  value: RecipeFieldsValue
  onChange: (patch: Partial<RecipeFieldsValue>) => void
  allTags: string[]
  disabled?: boolean
  /** hide notes on add-preview if we want; default show */
  showNotes?: boolean
}
```

Includes `TagsEditor` internally or as child. Image is **not** inside fields; `ImagePicker` sits next to it (image has async side effects).

**Preview currently cannot edit times.** After this, preview has prep/cook. `saveRecipe` uses the form values, not `extractedRecipe.prep_time`.

Manual form becomes:

```tsx
<ImagePicker ... />
<RecipeFields value={...} onChange={...} allTags={allTags} />
<Button>Speichern</Button>
```

Edit page: same.

---

## 3. `TagsEditor`

Extract from `preview.tsx:313-411` (cleanest copy). Used by fields. Autocomplete from `allTags`. Normalize with `normalizeTags` from `src/lib/utils.ts`.

`editRecipe` currently reimplements normalize (`recipe.ts:131-136`). Call `normalizeTags` instead.

---

## 4. `ImagePicker` / `useRecipeImagePicker`

One hook:

```ts
function useRecipeImagePicker(opts: {
  recipeId?: string          // present on edit; absent on add
  title: string
  category: RecipeCategory
})
```

Returns: candidates, loading, error, `search()`, `apply(url)`, `onFile(file)`, previewUrl.

On add: `apply` only sets local preview (remote URL or blob). Persist in `saveRecipe` (Phase 02).

On edit: `apply` calls `applyRecipeImageCandidateAction(recipeId, url)`.

`ImageSelectionModal` stays a presentational grid. German copy (Phase 06 if not here). Delete the “generate AI image” toast and `ResolvedRecipeImage.source: 'ai'` if nothing produces it (`image-types.ts`).

Align file size: **5MB** everywhere (`MAX_UPLOADED_IMAGE_SIZE_BYTES`). Camera extract path may still resize client-side to data URL for Gemini; that is not the hero image.

---

## 5. View pieces

Cut from current view mode:

- Hero image
- Title + badges + tags
- Stats row (prep/cook/total/servings)
- `ServingsStepper` — **44×44** hit targets (today `h-7 w-7` at `recipe-detail.tsx:854-893`)
- Ingredients (scaled)
- Instructions
- Notes (`renderNotesToHtml` isolated; keep escape)
- Actions row: print, export md, source link, collection, shopping, delete

Action row on mobile: wrap; consider a compact menu for secondary actions so primary “Auf die Einkaufsliste” stays 44px. Phase 06 can refine layout; this phase just composes.

---

## 6. Shared Zod

`src/lib/recipe-schema.ts`:

```ts
export const categorySchema = z.enum([...])
export const difficultySchema = z.enum([...])
export const recipeIdSchema = z.string().uuid()
```

Actions import this. Stop copying `categorySchema` in `add-recipe.ts`, `extract-recipe.ts`, `recipe.ts`.

AI `recipeSchema` in extractor and image-handler: one module `src/lib/ai/recipe-schema.ts` or the same file with extra `confidence` / `tags`. Duplicate `recipeSchema` in those two files is a bug — merge in Phase 07 if not here.

---

## 7. `allTags` plumbing

Today: library passes `allTags` into add modal (`library-view.tsx:462`) but **not** into `RecipePreview` (`modal.tsx:502-520`) so extract-preview autocomplete is empty.

Fix: pass `allTags` into `RecipeFields` on preview, manual, and edit. Edit page loads tags from `listRecipes()` on the server.

---

## 8. Delete dead UI

- `src/components/add-recipe/launcher.tsx` if still unused
- AI-image toast strings
- Dual drag hooks (should already be gone after 04)
- English leftover labels in the extracted files — replace as you touch them; Phase 06 is the sweep

---

## Implementation steps

1. Add `recipe-meta.ts`. Switch card, filter, export, view to it. Fix Leicht → Einfach. Build.
2. Extract `TagsEditor`. Switch three call sites.
3. Extract `RecipeFields`. Switch manual + edit + preview. Fix preview times → save path.
4. Extract `useRecipeImagePicker` + align 5MB.
5. Split view page into the small view components. Delete `recipe-detail.tsx`.
6. Grep for `CATEGORY_LABELS`, `Leicht`, `recipe-detail`, `No time set`, `No image available`. Zero hits except maybe comments.
7. `npm run build` && `npm run lint`.

---

## Acceptance

- `wc -l` on any `src/components/**/*.tsx` file is under 1000. Prefer under 400 for recipe modules.
- Changing a category label in `recipe-meta.ts` changes library, filter, detail, preview, export.
- Difficulty says Einfach everywhere.
- Extract preview can edit prep/cook and those values persist on save.
- Tag autocomplete works in extract preview.
- No `recipe-detail.tsx`.
- No unused launcher.

## Out of scope

- Visual redesign (Phase 06)
- i18n framework — one `recipe-meta` + German strings in components is enough
- Light mode tokens
