# Phase 02 — One recipe identity, images, delete, undo

**Status:** COMPLETED  
**Depends on:** 01  
**Goal:** A recipe’s `id` is stable for its whole life. Image files, collection membership, and undo all use that id.

---

## Why

Today three identities exist for one recipe:

1. `recipe.id` (UUID from `createRecipe`)
2. Image filename from `crypto.randomUUID()` at extract time (`extract-recipe.ts:70-73, 82, 139`)
3. A **new** UUID if undo goes through `createRecipe` after delete (`store.ts:387`, `recipe.ts:167-206`)

`deleteRecipe` only splices the recipes array (`store.ts:435-445`). It does not:

- strip `collection.recipe_ids`
- delete files under `recipe-images/`
- know about files named with a random UUID (`removeRecipeImageVariants` only matches `${recipeId}.`)

Confirm dialog says delete cannot be undone (`recipe-detail.tsx:1485`); library offers 30s undo (`library-view.tsx:267-273`).

Manual save can persist a `data:` URL if upload fails (`modal.tsx:391-425`, `manual-form.tsx` 10MB vs upload 5MB).

---

## Target data contract

After this phase (and a one-time migrate on load):

```
recipe.id            = uuid
recipe.image_url     = "/api/images/{recipe.id}.webp" | null
file on disk         = DATA_DIR/recipe-images/{recipe.id}.webp
```

No other image naming. `saveRecipe` / `setRecipeImage` reject `data:`, `http:`, `https:`, and paths that are not `/api/images/{uuid}.webp`.

Remote/Pexels URLs stay as **candidates** until commit. Bytes hit disk only when the recipe id is known.

---

## 1. Store API: upsert + cascade delete

### Replace the four patch functions with one patch

Today: `updateRecipe`, `updateRecipeImage`, `updateRecipeFavorite`, `updateRecipeRating` (`store.ts:417-499`) are the same splice with different omitted fields. `UpdateRecipeInput` explicitly omits `image_url`, `rating`, `is_favorite`.

**Target:**

```ts
type RecipePatch = Partial<Omit<Recipe, 'id' | 'user_id' | 'created_at'>>

export async function patchRecipe(recipeId: string, patch: RecipePatch): Promise<Recipe>
```

Always set `updated_at`. Keep `created_at`. Until Phase 09, keep writing `user_id: LOCAL_PROFILE_ID` if the field still exists.

Thin wrappers `updateRecipeFavorite` etc. can call `patchRecipe` or be deleted and have actions call `patchRecipe` directly.

### `upsertRecipe(recipe: Recipe)`

Used by undo and any restore:

- If `id` exists → replace that row, keep `created_at` unless caller supplies the original.
- If `id` missing → insert at the original index if provided, else unshift.
- Single queue tick. Includes `image_url`, `rating`, `is_favorite`, `notes`, `tags`.

### `createRecipe(input, options?: { id?: string; createdAt?: string; index?: number })`

Honor `options.id` when it is a UUID. Default remains `randomUUID()`. Undo uses this **or** `upsertRecipe` with the full original object.

### `deleteRecipe(recipeId)` in **one** queued operation

```
removed = splice recipes
for each collection: recipe_ids = recipe_ids.filter(id => id !== recipeId)
return removed
```

After the JSON write resolves, delete images (see below). If image delete fails, log; do not roll back the JSON (recipe is gone; orphan file is better than a ghost recipe). Inverse of today’s bug.

### Collection add must verify the recipe exists

`addRecipeToCollection`: if `findRecipeIndex < 0`, throw `Recipe not found`. Deduplicate `recipe_ids` on normalize (Phase 09 can also do this; do it here if cheap).

---

## 2. Image pipeline rewrite

### Delete the “download under random UUID” pattern

Stop these:

- `extractFromUrlAction` → `downloadImageToLocalStorage(imageUrl, crypto.randomUUID())` (`extract-recipe.ts:139`)
- `findRecipeImageAction` same (`:82`)
- `applyRecipeImageCandidateAction` same (`:70-73`)

### New flow A — URL extract

1. Fetch page (Phase 07 will add safe-fetch; this phase may still use current fetch).
2. Resolve image URL as a **string candidate** (absolute URL). Do not download yet.
3. Return `{ ...recipe, remoteImageUrl, source_url }` to the client. Do not write `recipe-images/` during extract.
4. On **Save**: `saveRecipe` creates the row, then `persistRemoteImage(recipe.id, remoteImageUrl)` downloads + webp + `patchRecipe({ image_url })` in a second queue tick **or** (better) `saveRecipe` accepts optional `remoteImageUrl` and does create+download+patch inside the action.

Prefer **one action** `saveRecipe` that:

```
parsed = schema.parse(input)
recipe = createRecipe(...)  // has id
if (file) saveUploadedRecipeImage(file, recipe.id) then patch image_url
else if (remoteImageUrl) downloadImageToLocalStorage(remoteImageUrl, recipe.id) then patch image_url
else if (imageUrl is already /api/images/{id}.webp) keep
else image_url = null
```

If download fails: recipe still saves, `image_url = null`, German toast “Rezept gespeichert, Bild konnte nicht geladen werden.” Never store the remote URL or a data URL.

### New flow B — Pexels / MealDB picker

Candidates remain remote URLs in the modal. Applying a candidate **in the add flow** only sets local React state (`preview.imageUrl = remote`). Persist on save as above.

Applying a candidate **on an existing recipe** (`recipeId` known): `applyRecipeImageCandidateAction(recipeId, imageUrl)` downloads as `{recipeId}.webp` and patches. UUID-validate `recipeId`.

### New flow C — user upload

`uploadRecipeImage` already uses `recipeId`. After Phase 03 it UUID-validates. This phase: after write, `image_url` is `/api/images/{recipeId}.webp`. Delete previous `{recipeId}.*` variants **after** durable write (Phase 01 helper).

### New flow D — extract from camera

Image is for OCR only (VISION: phone image discarded). Do not persist the photo as the recipe hero unless the user picks/uploads one in preview. Keep that product rule.

### `saveRecipe` image_url allowlist

Zod:

```ts
imageUrl: z.union([
  z.null(),
  z.string().regex(/^\/api\/images\/[0-9a-f-]{36}\.webp$/i),
]).optional()
```

Anything else is ignored / rejected. Client must not send data URLs.

### Helper: `deleteRecipeImages(recipe: Recipe)`

Delete:

1. All files in `recipe-images/` whose name starts with `{recipe.id}.`
2. If `image_url` is `/api/images/{name}`, and `name` is a safe image name (`isSafeImageName`), delete that file too (covers pre-migration random UUID files).

Call after successful `deleteRecipe`.

Export this from `images.ts`. Today `removeRecipeImageVariants` is private.

---

## 3. One-time migration of existing files

On `readStore` success (or a dedicated `migrateStoreMedia` called from first queued mutation / app boot):

For each recipe with `image_url` matching `/api/images/{file}`:

- If `{file}` is already `{recipe.id}.webp`, skip.
- If `recipe-images/{file}` exists:
  1. Read bytes (or `rename` if same extension webp).
  2. Write durable `{recipe.id}.webp` (re-encode via sharp if not webp).
  3. Patch `image_url` in memory.
  4. Delete the old file if its name ≠ new name.
- If file missing: set `image_url = null`.

Persist the rewritten store **once** through the queue if any row changed. Guard with `schema_version` (see below) so it does not re-encode every boot.

Also: leftover files in `recipe-images/` not referenced by any recipe and not `{someRecipeId}.*` — do **not** auto-delete in v1 of this phase (might be in-flight). Optional later sweep.

Live sample: recipe `2de2b557-…` points at `14714ee0-….jpg`. Migration must produce `2de2b557-….webp`.

---

## 4. `schema_version`

Add to `LocalStore`:

```ts
schema_version: number  // current: 2
```

- Missing version → treat as 1.
- Version 2: image names match recipe id; settings field names are the unified gemini_* (already normalized in memory).

`normalizeStore` fills `schema_version`. Only `writeStore` from a migration mutation bumps it.

Do not use this for SQLite. Just a JSON document version.

---

## 5. Undo / restore

### `restoreRecipe` action rewrite

```
upsertRecipe({
  ...parsed,
  id: parsed.id,          // required
  created_at: original.created_at if we still have it on the client
})
```

Library undo already keeps the full `Recipe` in `pendingDeletionRef`. Send the whole object. One store write.

If the user saved a new recipe with the same id in the 30s window (impossible unless we reuse ids — we do not), upsert replaces it. Fine.

### Copy

Delete confirm (Phase 06 German/du): “Rezept in den Papierkorb. Du kannst es kurz rückgängig machen.” Or drop the confirm lie and keep the 30s toast as the only undo. Pick **one** story:

**Recommended:** keep confirm; copy says it can be undone for a short time; toast still offers Rückgängig. After 30s, gone.

Do not say “kann nicht rückgängig gemacht werden.”

### `createRecipe` after delete must not mint a new id

If any code path still calls `createRecipe` without id for undo, that is a bug. Ban it in this phase.

---

## 6. Double writes to remove

- `recipe-detail.tsx:590-595`: `uploadRecipeImage` already `updateRecipeImage`; then `setRecipeImage` writes again. After this phase, `uploadRecipeImage` is the only image mutation; UI does not call `setRecipeImage` afterwards.
- `restoreRecipe` sequential favorite + rating + image writes → one upsert.

---

## 7. Cache headers

Image route uses `Cache-Control: public, max-age=31536000, immutable` (`api/images/.../route.ts:21`). After replacing `{id}.webp` in place, browsers keep the old bytes.

**Fix:** either:

- Content-hash names (not desired; we want `{id}.webp`), or
- `Cache-Control: public, max-age=31536000` **without** `immutable`, plus `?v={updated_at}` on `image_url` query, or
- bump a `?m={mtime}` in `toImageUrl`.

Recommended: `toImageUrl(fileName, version?: string)` appends `?v={recipe.updated_at}` from the caller. File on disk stays `{id}.webp`. Route ignores the query. Immutable is acceptable only if the URL changes on replace.

---

## Files to change

| File | Change |
|---|---|
| `src/lib/local/store.ts` | `patchRecipe`, `upsertRecipe`, `createRecipe({ id })`, cascade delete, `schema_version`, migrate-on-write |
| `src/lib/local/images.ts` | `{id}.webp` only; `deleteRecipeImages`; durable write already from 01; `toImageUrl` |
| `src/app/actions/add-recipe.ts` | `saveRecipe` persists image after id exists; allowlist `image_url`; `uploadRecipeImage` UUID (or Phase 03) |
| `src/app/actions/extract-recipe.ts` | No download during extract; return remote URL; `applyRecipeImageCandidateAction(recipeId, url)` |
| `src/app/actions/recipe.ts` | `restoreRecipe` → upsert; `deleteRecipeAction` deletes images; `revalidateApp()` |
| `src/app/actions/collections.ts` | existence check already in store |
| `src/components/add-recipe/modal.tsx` | Do not `saveRecipe` with data URLs; pass `File` or remote URL into save |
| `src/components/add-recipe/manual-form.tsx` | Align 5MB limit with upload; do not set `imageUrl` to data URL for save |
| `src/components/library/library-view.tsx` | Undo uses original id; no `restored.id` remapping needed if upsert is correct |
| `src/components/library/recipe-detail.tsx` | Stop double `setRecipeImage` (or the split files in Phase 05) |
| `src/types/index.ts` | `schema_version` is store-only, not on Recipe. Optional `ParsedRecipe.remote_image_url` |
| `docs/local-pi-deployment.md` | Document `{recipeId}.webp` as the real contract (docs already claimed this; make it true) |

---

## Implementation steps

1. Add `schema_version` + `upsertRecipe` + `patchRecipe` + cascade `deleteRecipe` without changing image names yet. Build.
2. Change image write to always `{recipeId}.webp`. Change extract/apply to not download without id.
3. Change `saveRecipe` to persist bytes after create.
4. Client: stop sending data URLs; pass File / remote URL.
5. Migration pass for existing `{random}.jpg` files.
6. Rewrite `restoreRecipe` + undo UI assumptions.
7. Cache-bust query on image URLs.
8. Manual test matrix (below).

---

## Manual test matrix

| Case | Expect |
|---|---|
| Add from URL with og:image, save | File `{newId}.webp` exists; `image_url` matches; no extra random UUID file |
| Add from URL, cancel after preview | No new file in `recipe-images/` |
| Replace image on existing recipe | `{id}.webp` replaced; old random file from before migration gone after migrate; browser shows new image (query bump) |
| Delete recipe | Row gone, collection membership gone, `{id}.webp` gone |
| Delete + undo within 30s | **Same** id, same `created_at`, image restored if we still have bytes — **note:** if we deleted the file, undo cannot restore the image unless we delay file delete until undo window ends **or** we keep the file until toast expires |
| Manual add with photo 4MB | Saved, webp on disk |
| Manual add with 8MB photo | Client rejects at 5MB; nothing in store |
| Backup restore (images not in JSON) | Covered in Phase 03; here at least `image_url` still points at `{id}.webp` |

### Undo vs image files (decide here)

**Recommended:** delay physical image delete until the undo toast expires (30s), or move files to `recipe-images/.trash/{id}.webp` and purge after 30s / next boot. If the user undoes, move back. If you delete immediately, undo restores metadata without photo.

Simplest implementation that preserves identity: **trash folder**.

```
deleteRecipe → json cascade + rename image to .trash/{id}.webp
undo → upsertRecipe + rename .trash back to {id}.webp
timeout / next boot → unlink .trash
```

Put `.trash/` in the images dir. Ignore it in the GET route (`isSafeImageName` must reject names with extra path; `.trash/foo` already fails the regex because of `/`). Use `path.join(dir, '.trash', fileName)` from server code only.

---

## Acceptance

- Extract-then-cancel does not grow `recipe-images/`.
- Every saved recipe with a photo has exactly one file `{id}.webp`.
- Delete removes membership + (after undo window) the file.
- Undo keeps `recipe.id`.
- `tiptopf.json` never contains `data:image`.
- Existing Pi library photos still show after first boot (migration).

## Out of scope

- SSRF on download (Phase 03/07 `safe-fetch`)
- Recipe as a page (Phase 04)
- Splitting the 1561-line component (Phase 05) — but do not add more code to it than required for undo copy / stop double write
