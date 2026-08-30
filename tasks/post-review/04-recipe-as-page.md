# Phase 04 — Recipe is a page

**Status:** NOT STARTED  
**Depends on:** 02 (stable ids), 03 not strictly required but do not regress security  
**Goal:** Opening a recipe is a URL. Back, print, share, collections, and cook layout all use that page. The library overlay is deleted.

---

## Why

VISION asked for a full-screen recipe view. Implementation is client state in `LibraryView` (`selectedRecipeId`) plus a 92svh sheet / 32rem modal (`recipe-detail.tsx:762`). Consequences:

- Hardware / browser back leaves `/library`; the sheet stays in memory or is already gone depending on navigation — either way the recipe is not a history entry.
- Print CSS hides `.fixed` (`globals.css:63-66`); `DialogContent` is `fixed` → print prints the masonry grid.
- Collections cannot reuse the 1561-line dialog, so they show a stub “In Bibliothek öffnen” (`collection-detail-view.tsx:311-338`).
- Leaving to Einkaufsliste loses the open recipe.
- No deep link.

This phase is the structural judo for the UI. Phase 05 splits the file; Phase 06 restyles. **Do not** restyle inside the dialog in this phase — change the **host**.

---

## Target IA

| URL | Surface |
|---|---|
| `/library` | Grid + filters + FAB. Cards are links. |
| `/library/[id]` | Recipe **view**. Full viewport. Server-rendered shell + client islands for favorite/rating/servings/shopping. |
| `/library/[id]/edit` | Recipe **edit**. Full page form (shared `RecipeFields` may still live in the giant file until Phase 05). |
| `/library/[id]/print` | Optional. Prefer print CSS on the view page once it is in normal flow. Only add a dedicated print route if print CSS is still fighting the app chrome. |
| `/collections/[id]` | Collection grid. Cards link to `/library/[recipeId]?from=collection&collectionId=` **or** simply `/library/[id]` (back can use `router.back()`). |

Do **not** implement Next parallel routes `@modal` in this phase. One URL, one page. Desktop can later overlay; not required to fix the bugs.

---

## Routing details

### Load

`src/app/library/[id]/page.tsx`:

```ts
export const dynamic = 'force-dynamic'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipe = await getRecipe(id) // add getRecipe(id) to store.ts if missing
  if (!recipe) notFound()
  const collections = await listCollections()
  const allTags = unique tags from listRecipes() or a cheap helper
  return <RecipeViewPage recipe={recipe} collections={collections} allTags={allTags} />
}
```

Add `src/app/library/[id]/not-found.tsx` German: “Rezept nicht gefunden.”

`getRecipe` is a linear scan; fine.

### Navigation from the grid

`RecipeCard` wraps in `Link href={`/library/${recipe.id}`}` or `onOpen` becomes a router push. Prefer `<Link>` for prefetch and open-in-new-tab.

Favorite/rating on the **card** stay buttons with `stopPropagation` / `e.preventDefault` so they do not navigate. They already stop on the inner controls — verify.

### Back

View page header: “Zurück” → `router.back()` with fallback `href="/library"`.

### After save from add-modal

Today: `onRecipeSaved` patches library state and may open the detail overlay. After this phase: `router.push(`/library/${saved.id}`)` or stay on library (product pick).

**Recommended:** after add, go to `/library/[id]` so the cook sees the result. Modal closes.

### After delete

`deleteRecipeAction` then `router.push('/library')`. Undo toast can live in library (session) or a global toaster — the library already has the 30s undo. If delete happens on the recipe page, push to library **and** show the toast there. Pass undo payload via:

- sessionStorage `pendingUndo`, or
- keep toast in a client provider at layout level.

Simplest: delete action on the recipe page calls the same `library` undo only if we lift undo to a small `UndoProvider` in `layout.tsx`. Do not overbuild: toast on recipe page “Gelöscht” with action that calls `restoreRecipe` then `router.push(/library/id)`.

### Edit

Link “Bearbeiten” → `/library/[id]/edit`. Cancel → view. Save → view (`revalidatePath`, `redirect`).

Keyboard / iOS: edit is a full page, so the browser resizes the visual viewport against `document`, not a 92svh sheet. This is the actual fix for the keyboard collision. Phase 06 polishes; the route is the prerequisite.

---

## What happens to `RecipeDetail` in this phase

Do **not** rewrite 1561 lines into a perfect module graph yet (that is Phase 05). This phase:

1. Add a `presentation="page"` mode **or** extract a `RecipeView` that renders the view-mode JSX without `Dialog`.
2. Stop using `Dialog` / `isMobile` matchMedia for view.
3. Delete overlay state from `LibraryView` (`selectedRecipeId`, `<RecipeDetail open=...>`).
4. Point collections cards at the route; **delete the stub dialog**.

If the fastest path is: copy view-mode JSX into `recipe-view-page.tsx` and leave edit in the old file for one phase, do that — but do not leave two diverging view UIs for long. Phase 05 must converge.

**Forbidden:** adding more features to the dialog path.

### Drag-to-close

Sheet drag (`recipe-detail.tsx:307-393` and `686-736`) **goes away** for view. The page scrolls natively. Delete both drag systems when the overlay is gone. That is a complexity deletion, not a rewrite.

### Servings scaling, shopping, collections, notes

These stay on the view page as client islands. They do not require a dialog.

Add-to-collection modal can remain a **small** dialog on the page (not nested in a sheet). Delete confirm too.

---

## Print

Once the recipe is in document flow:

`globals.css` `@media print`:

- Hide `TopNav`, `BottomNav`, FAB, toaster, page actions that are not content (`[data-print-hide]`).
- **Do not** `display: none` on all `.fixed` if that also hides something we need — be explicit: `nav, [data-print-hide] { display: none }`.
- Recipe article `data-print-root`: black on white, images page-break-inside avoid (already partly there).

“Drucken” on the view page calls `window.print()`. Manual test: print preview shows title, ingredients, steps, not the grid.

If anything is still portaled, add `/library/[id]/print` as a chrome-free layout (`layout.tsx` segment without nav). Prefer CSS first.

---

## Layout chrome on the recipe page

- Bottom nav still visible on mobile (cook can jump to shopping list). That is OK. Recipe content uses the same `pb-[max(6rem,env(safe-area-inset-bottom))]` as other pages.
- No FAB on the recipe page (FAB is library-only).
- Top nav on `md+` still works; highlight Bibliothek as active (`pathname.startsWith('/library')` already true).

Safe-area top: Phase 06. In this phase, at least use the same `main` padding as library so it is not worse.

---

## Collections

`collection-detail-view.tsx`:

- Card click → `router.push(`/library/${recipe.id}`)` or `<Link>`.
- Remove the stub `Dialog` at lines 311–338.
- Favorite/rating on collection cards: Phase 08 will fix snap-back; this phase at least navigates to a page where they work.

“Zur Sammlung” from the recipe page: keep the small modal. Show it even when `collections.length === 0` (create first collection). That bug is in `recipe-detail.tsx:988-997` — fix when moving actions onto the page.

---

## `LibraryView` after this phase

State that **stays**: recipes list, filters, sort, add modal, random draw, pull-to-refresh, undo toast.

State that **goes**: `selectedRecipeId`, detail open handlers.

Random draw: on pick, `router.push(`/library/${id}`)` instead of opening overlay. The draw dialog can close.

---

## Files

| File | Change |
|---|---|
| `src/app/library/[id]/page.tsx` | **Create** |
| `src/app/library/[id]/edit/page.tsx` | **Create** |
| `src/app/library/[id]/not-found.tsx` | **Create** |
| `src/lib/local/store.ts` | `getRecipe(id)` if missing |
| `src/components/library/recipe-view.tsx` | **Create** (view body without Dialog) |
| `src/components/library/recipe-edit-form.tsx` | **Create** or temporarily reuse edit JSX |
| `src/components/library/library-view.tsx` | Links; remove overlay |
| `src/components/library/recipe-card.tsx` | `Link` |
| `src/components/library/random-recipe-drawer.tsx` | Navigate on select |
| `src/components/collections/collection-detail-view.tsx` | Links; delete stub |
| `src/components/add-recipe/modal.tsx` | After save, `router.push` |
| `src/app/globals.css` | Print selectors |
| `src/components/library/recipe-detail.tsx` | Delete once view+edit hosts exist, or shrink to re-exports. **Must not remain the overlay host.** |

---

## Implementation steps

1. Add `getRecipe` + recipe view page that renders a **minimal** German layout (title, ingredients, steps) using existing recipe fields. Verify `/library/[id]` works and print preview shows the recipe. Do not wait for pixel-perfect chrome.
2. Point cards + collections + random at the route. Remove `selectedRecipeId`.
3. Move favorite, rating, servings, shopping, notes, actions onto the view page (cut-paste from recipe-detail).
4. Add edit route; move edit form.
5. Delete Dialog/sheet/drag from recipe-detail; delete the file if empty.
6. Print CSS.
7. After-add navigation.
8. `npm run build`. Manual: phone back button from recipe returns to library. Print. Collection card opens the recipe.

---

## Acceptance

- `/library/{uuid}` shows the recipe without a dialog.
- Browser back from recipe returns to the previous app page.
- `window.print()` from the recipe page prints the recipe, not the grid.
- Collection cards never show the stub dialog.
- `LibraryView` has no `selectedRecipeId`.
- Sheet drag code is gone.
- Zoom still disabled (`layout.tsx` `maximumScale: 1`).

## Out of scope

- Parallel-route modal on desktop
- Cook-mode keep-awake / step check-off (Phase 11)
- Pinterest masonry rewrite (Phase 11 / light touch in 06)
- Splitting into 15 files (Phase 05) — a view page + edit page is enough here
