# Edit Recipe Entries — Implementation Plan

## Overview
Add the ability to edit existing recipe entries, replace the RecipeDetail Sheet with a Dialog popup card, and improve AI extraction prompts for German translation and metric conversion.

---

## 1. Backend: Store layer (`src/lib/local/store.ts`)

### `updateRecipe(id, input)`
- Accepts `Partial<Recipe>` excluding immutable fields: `id`, `user_id`, `created_at`, `updated_at`, `rating`, `is_favorite`, `image_url`
- Spreads input onto existing recipe
- Sets `updated_at` to current timestamp
- Uses existing `runMutatingStoreOperation` pattern

### `deleteRecipe(id)`
- Removes recipe from the recipes array
- Throws if recipe not found
- Used after undo window expires

---

## 2. Backend: Server action (`src/app/actions/recipe.ts`)

### `editRecipe(recipeId, input)`
- Zod validates all fields as optional:
  - `title`: `z.string().min(1)`
  - `ingredients`: `z.array(z.string())`
  - `instructions`: `z.string().min(1)`
  - `prep_time`: `z.number().int().min(0).nullable()`
  - `cook_time`: `z.number().int().min(0).nullable()`
  - `servings`: `z.number().int().min(1).nullable()`
  - `category`: `z.enum(['starter', 'main', 'dessert', 'side', 'breakfast', 'snack'])`
  - `difficulty`: `z.enum(['easy', 'medium', 'hard'])`
- Calls `updateRecipe`
- Revalidates `/library`

### `deleteRecipeAction(recipeId)`
- Zod validates recipeId as `z.string().uuid()`
- Calls `deleteRecipe`
- Revalidates `/library`

### `restoreRecipe(input)`
- Re-creates a recipe from full data (used by undo)
- Calls `createRecipe` with original data minus `id`/`created_at`/`updated_at`
- Revalidates `/library`

---

## 3. UI: Replace Sheet with Dialog popup card (`src/components/library/recipe-detail.tsx`)

### Change from Sheet to Dialog
- Replace `<Sheet>` component with `<Dialog>` (using existing `DialogContent`, `DialogHeader`, etc.)
- Card size: `max-w-2xl`
- Centered popup with background overlay (`DialogOverlay`)
- Close button in top-right corner (already in `DialogContent`)

### View mode
- Image at top (if exists)
- Title and badges (category, difficulty)
- Info grid: prep time, cook time, total time, servings
- Rating component
- Ingredients list (bullet points)
- Numbered instruction steps (parsed from newline-separated string)
- Print and Open source buttons at bottom
- Edit (pencil) icon button in header, next to FavoriteButton

### Edit mode (triggered by edit button)
- Same Dialog/card container, content morphs in-place
- Form fields:
  - **Title**: `<Input>`
  - **Category**: `<Select>`
  - **Difficulty**: `<Select>`
  - **Prep time**: number `<Input>` (minutes)
  - **Cook time**: number `<Input>` (minutes)
  - **Servings**: number `<Input>`
  - **Ingredients**: `<textarea>`, one per line, parsed to `string[]` on save, joined with `\n` on load
  - **Instructions**: `<textarea>`, one step per line, stored as single string with `\n` separators
  - **Image**: reuse image picker from add-recipe (upload, find, generate via existing actions)
- Validation on save:
  - Title required (min 1 char)
  - Instructions required (min 1 char)
  - At least 1 ingredient
- Save button: validates, calls `editRecipe` action, switches back to view mode
- Cancel button: reverts to view mode without saving
- Delete button (destructive style): appears at bottom of edit form

---

## 4. UI: Delete with undo

### Confirmation dialog
- Use existing `<Dialog>` component
- Message: "Are you sure you want to delete this recipe? This cannot be undone."
- Two buttons: "Cancel" and "Delete" (destructive)

### Undo flow
- On confirm delete: optimistic removal from local state, close the Dialog
- Show Sonner toast: "Recipe deleted" with "Undo" button, auto-dismiss in 30 seconds
- Store deleted recipe in a `useRef` to survive re-renders
- If user clicks "Undo" within 30 seconds:
  - Clear the timeout
  - Restore recipe to local state
  - Call `restoreRecipe` action
- If timer expires (30s):
  - Call `deleteRecipeAction` to persist the deletion

### Library view update (`src/components/library/library-view.tsx`)
- Extend `patchRecipe(recipeId, patch)` to accept `Partial<Pick<Recipe, 'title' | 'ingredients' | 'instructions' | 'prep_time' | 'cook_time' | 'servings' | 'category' | 'difficulty'>>`
- Update `RecipeDetail` props: swap Sheet props for Dialog props (`open`, `onOpenChange`)
- Wire `onRecipeSaved` callback (already exists for add) — rename/add `onRecipeUpdated` to update recipe in local state when edit saves

---

## 5. AI Prompt improvements (`src/lib/ai/prompts.ts`)

Update `RECIPE_SYSTEM_PROMPT`:

### Translation
- Translate ALL text output (title, ingredients, instructions) to **German**, regardless of source language

### Metric conversion
Convert all imperial/imperial-volume units to metric:
- Weight: oz, lb → g
- Volume: cups, tbsp, tsp → ml
- Temperature: °F → °C
- Length: inches → cm
- Other common cooking units (stick of butter → g, pinch → small amount in g/ml)

### Step formatting
- Format instructions as clearly separated numbered steps
- Each step on its own line, prefixed with `1.`, `2.`, etc.
- NOT a single paragraph

### Keep as-is
- `category` and `difficulty` remain English enum values
- `confidence` remains a number between 0 and 1
- JSON structure unchanged

---

## 6. Files to create/modify

| File | Change |
|------|--------|
| `src/lib/local/store.ts` | Add `updateRecipe()`, `deleteRecipe()` |
| `src/app/actions/recipe.ts` | Add `editRecipe()`, `deleteRecipeAction()`, `restoreRecipe()` |
| `src/components/library/recipe-detail.tsx` | Rewrite: Sheet → Dialog, add edit mode, delete flow |
| `src/components/library/library-view.tsx` | Extend `patchRecipe`, update RecipeDetail props |
| `src/lib/ai/prompts.ts` | Update system prompt: German, metric, numbered steps |

---

## 7. Not in scope
- Editing from the RecipeCard (card stays read-only, edit only in detail Dialog)
- Drag-and-drop ingredient/step reordering
- Editing `source_url` or `source_type` (set at creation only)
- Bulk edit
