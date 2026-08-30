# Phase 08 — Client state, shopping list, cache

**Status:** NOT STARTED  
**Depends on:** 02 (upsert/ids), 04 (recipe page; collections link there)  
**Goal:** UI state follows server action return values. No temp ids. Favorites/ratings do not snap back. Extract can be cancelled.

---

## Why

Several screens copy server props into `useState` and never sync:

- `ShoppingListView` (`shopping-list-view.tsx:59`)
- `LibraryView` recipes (`library-view.tsx:79`) — OK if we patch locally, but `revalidatePath('/library')` does not refresh that state; pull-to-refresh does
- `CollectionDetailView` uses server recipes without local patches

Concrete bugs:

1. Manual shopping add uses `id: temp-${Date.now()}` (`shopping-list-view.tsx:95-108`). `toggleShoppingListItemAction` parses UUID (`shopping-list.ts:42-44`) → throw → rollback. Comment says revalidate will refresh; `useState(initialItems)` does not.
2. Favorites/ratings on collection cards snap back; actions only `revalidatePath('/library')`.
3. Add-recipe extract has no abort; close + in-flight await still `setPhase('preview')`.
4. Creating a collection from a recipe does not update library collections state; “Zur Sammlung” hidden when `collections.length === 0`.
5. `useOptimistic` for rating dispatched outside `startTransition` (`rating.tsx:36-39`).
6. `restoreRecipe` failure leaves the recipe in client state (`library-view.tsx:226-229`) — Phase 02 upsert should make restore reliable; still handle errors.
7. Ingredient scaling treats tokens length ≤ 5 as units (`ingredient-scaling.ts:120`) — `3 Eier` wrong.

---

## 1. Shopping list

### Actions return data

```ts
export async function addManualItemAction(text: string): Promise<ShoppingListItem>
export async function addRecipeIngredientsToShoppingList(...): Promise<ShoppingListItem[]>
export async function toggleShoppingListItemAction(...): Promise<ShoppingListItem[]>
```

Simplest robust API: **return the full list** from every mutation (`addToShoppingList` already returns the list). Client replaces state with the return value. No temp ids.

```ts
const next = await addManualItemAction(text)
setItems(next)
```

Optimistic add is optional. If kept: use a real UUID generated on the client **and** pass it to the action (`create` honors id) — worse than just waiting. Prefer wait: add is one round trip on LAN/Pi.

### Sync props

```ts
useEffect(() => { setItems(initialItems) }, [initialItems])
```

Or drop local state and `router.refresh()` after each action (actions already `revalidatePath('/einkaufsliste')`). Return-value replace is faster UX than refresh.

### Grouping

Keep `sourceRecipeTitle` + servings groups for now. Phase 11 can add `source_recipe_id`. If easy in this phase: store `sourceRecipeId` on `ShoppingListItem` (optional field, normalize in store). Not required.

### Touch targets

Phase 06. If 08 lands first, still bump checkbox/delete to 44px here.

---

## 2. Favorites and ratings

### `FavoriteButton` / `Rating`

- Move `setRatingOptimistic` **inside** `startTransition`.
- Collection cards: either
  - local recipe map in `CollectionDetailView` with `onFavoriteChange` / `onRatingChange` (copy LibraryView `patchRecipe`), or
  - after Phase 04, cards only navigate and show **read-only** rating (Phase 06). Favorite heart still needs a patch or it snaps back.

**Do both:** read-only rating on cards (06) + local optimistic favorite with parent patch (08).

### `revalidateApp()`

Phase 00/02 helper. `toggleFavorite` / `setRating` must revalidate `/library`, `/library/[id]`, `/collections`, `/collections/[id]`.

---

## 3. Extract cancellation

`AddRecipeModal` extract handlers: generation token.

```ts
const gen = ++extractGenRef.current
const result = await extractFromUrlAction(...)
if (gen !== extractGenRef.current) return
```

On close / `resetState`: increment the token. Ignore stale `setPhase('preview')`.

Same for image extract and candidate search.

Do not add AbortController to the server action unless easy; ignoring stale results is enough (the server work still runs — acceptable).

---

## 4. Collections from recipe page

- Always show “Zur Sammlung”, even if `collections.length === 0`.
- After `createCollectionAction` + `addRecipeToCollectionAction`, update local collections **or** `router.refresh()`. Recipe page is a server component host: `router.refresh()` is the straightforward fix after Phase 04.
- Modal list counts must update.

---

## 5. Library list state

After Phase 04, opening a recipe does not need `selectedRecipeId`. Remaining issues:

- After add via modal, `onRecipeSaved` currently patches the array. If we `router.push` to the recipe page, also `router.refresh()` library or patch before navigate.
- Pull-to-refresh stays.
- Sync `initialRecipes` when the server re-renders:

```ts
useEffect(() => { setRecipes(initialRecipes) }, [initialRecipes])
```

Beware: this can overwrite optimistic favorite if a refresh lands mid-flight. Prefer patch-from-action-return instead of hoping revalidate updates the client island.

**Code-judo:** mutation actions return the updated `Recipe`. Client patches by id. Do not keep `as Recipe` casts (`library/page.tsx:13-14` — `listRecipes()` already returns `Recipe[]`).

---

## 6. Ingredient scaling

File: `src/lib/ingredient-scaling.ts`.

Problems:

- `length <= 5` token as unit → `Eier`, `Mehl`, `Salz` become units
- Mixed `1½` / `1 1/2` not parsed as 1.5
- Unparsed lines pass through (safe)

Fix:

- Only treat a token as unit if it is in `KNOWN_UNITS` **or** a small allowlist of piece words (`el`, `tl`, `g`, `kg`, `ml`, `l`, `stk`, `prise`, …). Do **not** use length.
- Parse leading mixed numbers: `1 1/2`, `1½`, `1,5`.
- Add unit tests in Phase 10; implement the parser fix here so 10 can lock it.

When adding to shopping list, continue storing the **scaled display string** (Phase 02/11 structured ingredients are backlog). Wrong scale is still worse.

---

## 7. Other correctness nits to fold in

| Item | Action |
|---|---|
| `listRecipesAction` / `listCollectionsAction` thin wrappers | Pages can import store directly (they already do). Delete the unused actions or keep for pull-to-refresh from the client — client **cannot** import store. Keep the actions for PTR; they are justified. |
| Fake streaming text | Phase 06 copy; here do not add more stream state |
| `manual-form` revokeObjectURL on data URL | Harmless; remove if touching |
| Sheet drag timeouts | Gone after Phase 04 |
| Collection stub | Gone after Phase 04 |

---

## Files

| File | Change |
|---|---|
| `src/app/actions/shopping-list.ts` | Return lists/items |
| `src/components/shopping/shopping-list-view.tsx` | No temp id; setState from return; optional sync effect |
| `src/app/actions/recipe.ts` | `revalidateApp`; rating/favorite |
| `src/components/interactions/rating.tsx` | optimistic inside transition; German errors |
| `src/components/interactions/favorite-button.tsx` | German aria if not 06 |
| `src/components/collections/collection-detail-view.tsx` | local patch or read-only + refresh |
| `src/components/add-recipe/modal.tsx` | generation token |
| `src/lib/ingredient-scaling.ts` | unit allowlist; mixed numbers |
| `src/components/library/library-view.tsx` | drop leftover overlay state if 04 missed it; remove `as Recipe[]` |
| `src/app/library/page.tsx` | drop pointless casts |

---

## Implementation steps

1. Shopping actions return full list; rewrite client add/toggle/remove/clear. Manual test add-then-check.
2. Rating optimistic inside transition; revalidateApp.
3. Extract generation token.
4. Zur Sammlung always visible; refresh after create.
5. Scaling parser + a few node-side tests if Phase 10 harness not ready: even a `ingredient-scaling.test.ts` with a tiny runner later.
6. Build.

---

## Acceptance

- Add a shopping item, immediately check it: no Zod error, item stays checked, survives reload.
- Favorite a recipe on a collection card (or on recipe page and return): heart stays on.
- Close add-modal during extract: reopening does not flash the previous preview.
- First collection can be created from a recipe.
- `2 Eier` scaled to 4 servings from 2 stays “4 Eier” not a weird unit split.
- No `temp-` ids in the shopping list.

## Out of scope

- Merging duplicate ingredient lines
- Structured ingredient columns in the JSON store
- Global client store (Zustand etc.) — not needed
