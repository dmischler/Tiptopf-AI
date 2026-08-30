# Phase 01 — Stop data loss (durability)

**Status:** COMPLETED  
**Depends on:** 00  
**Goal:** A crash, truncated write, or hand-edited invalid JSON must not wipe recipes, collections, shopping list, or API keys.

---

## Why

`src/lib/local/store.ts` uses temp-file + `rename` (good atomicity) but:

1. No `fsync`. On a Pi SD card, power loss can leave empty or last-good-unknown state.
2. `SyntaxError` on read **resets the library to empty defaults** after a best-effort backup rename (`store.ts:343-353`). If the backup rename fails, `writeStore` overwrites the original.
3. `importStoreJson` and first-boot `writeStore` **bypass `writeQueue`** (`store.ts:337-340`, `641-658`). Concurrent mutations can clobber import or get clobbered.
4. Image files use in-place `writeFile` with no temp/rename/fsync (`src/lib/local/images.ts:103`).

This is the highest-severity product bug. Fix it before identity, UI, or security polish.

---

## Current behavior (cite)

| Path | What happens |
|---|---|
| `store.ts:321-327` `writeStore` | `writeFile(tmp)` then `rename`. No fsync. |
| `store.ts:329-357` `readStore` | ENOENT → create empty store and write it. `SyntaxError` → rename to `.backup.{ts}` (ignore failure) → write empty default → return empty. Other errors throw. |
| `store.ts:360-376` `runMutatingStoreOperation` | Serializes mutations in-process. Failures swallowed on the queue tail so the chain continues. |
| `store.ts:641-658` `importStoreJson` | `JSON.parse` → `normalizeStore` → `writeStore` directly. |
| `images.ts:97-105` `writeRecipeImage` | In-place write after deleting variants. |

---

## Target behavior

### 1. Durable JSON write

Extract `writeJsonAtomic(filePath, text)` (new `src/lib/local/durable-write.ts` or private in `store.ts`):

1. `mkdir` parent recursive.
2. Write `{filePath}.tmp.{uuid}` with `fs.open` / `FileHandle.writeFile` (or `writeFile` then reopen).
3. `await fh.sync()` (fsync the temp file).
4. `await fh.close()`.
5. `await fs.rename(temp, filePath)` (atomic replace on same filesystem).
6. `fsync` the **directory** (`fs.open(dir, 'r')` then `sync`). Directory fsync is what makes the rename durable on ext4.

Pretty-print JSON (`JSON.stringify(store, null, 2)`) stays; this is a single-user inspectable file.

### 2. Durable image write (same helper, binary)

`writeRecipeImage` must:

1. Write to `{file}.tmp.{uuid}`.
2. fsync.
3. rename onto `{recipeId}.webp`.
4. fsync dir.

Do **not** delete old variants until the new file is durable. Order:

1. Write new durable file (if replacing same name, write temp then rename over).
2. Then delete other prefixes (`{id}.jpg` leftover, etc.).

### 3. Corrupt JSON: fail closed

On `SyntaxError` (or non-object parse that `normalizeStore` cannot salvage **because the file is truncated garbage**):

- **Do not** write an empty default over the live path.
- Copy or rename the bad file to `tiptopf.json.corrupt.{iso}` if the rename succeeds; if rename fails, leave the file in place.
- Throw a typed error, e.g. `StoreCorruptError`, with the backup path.
- Surface it: root `error.tsx` (German) and/or library page: “Die Bibliothek-Datei ist beschädigt. Die Datei liegt unter … Stelle ein Backup wieder her.”
- Do **not** create a new empty `tiptopf.json` automatically.

Distinguish:

| Condition | Action |
|---|---|
| File missing (`ENOENT`) | Create default empty store (first boot). Still go through the queue + durable write. |
| File empty string / whitespace | Treat as corrupt, not as first boot. |
| JSON parse error | Corrupt. |
| JSON parses to non-object | Corrupt (import already rejects this; read path currently `normalizeStore`s into empty — **stop doing that on read of a live file**). |
| JSON parses to object missing `recipes` | If this is a live read: treat as corrupt. Import already requires `recipes` + `collections`. |
| JSON parses, some recipes have bad fields | Keep `normalizeRecipe` coercion for **field-level** repair (unknown category → main). Do not mint a new id for a recipe that **has** an id. Missing id: skip that row and log, or keep but do not silently `randomUUID()` without logging. Prefer: drop invalid rows from the in-memory list, do **not** persist the drop until a later explicit mutation, **or** persist only after logging. Simplest safe rule for this phase: **do not persist coercions on read**. Normalize for the running process; only `writeStore` from mutating operations. |

**Important code-judo:** `readStore` should be read-only except ENOENT first-boot. Today `readStore` writes on ENOENT **and** on SyntaxError. After this phase, only ENOENT writes, and that write must be queued.

### 4. Queue everything

```ts
async function runMutatingStoreOperation<T>(operation: (store: LocalStore) => T | Promise<T>): Promise<T>
```

Use it for:

- all current CRUD
- `importStoreJson` (replace the in-memory store object fields, then the queued write)
- first-boot initialization (a dedicated `ensureStoreExists` that is itself queued)

Pattern for import:

```ts
export async function importStoreJson(raw: string) {
  const parsed = JSON.parse(raw) // throw German error on failure
  assertImportShape(parsed)
  const incoming = normalizeStore(parsed)
  return runMutatingStoreOperation((store) => {
    store.recipes = incoming.recipes
    store.collections = incoming.collections
    store.shoppingList = incoming.shoppingList
    store.settings = incoming.settings
    store.profile = incoming.profile // until Phase 09 drops it
  })
}
```

This serializes with other mutations. Still a full replace (Phase 03 adds confirm + key stripping).

### 5. Optional last-good snapshot (recommended, small)

Immediately before a successful durable replace of `tiptopf.json`, copy the previous file to `tiptopf.json.bak` (single rolling last-good). Do this **inside** the queued mutation after read, before write:

- If current file exists and parses, keep it as `.bak` via rename-copy.
- Import/reset then has an automatic undo file on disk.
- Do not rotate an unbounded number of backups in this phase (corrupt files already get a timestamped name).

### 6. Do not fsync-skip on the queue error path

Today:

```ts
writeQueue = next.then(() => undefined, () => undefined)
```

Keep swallowing so one failed mutation does not deadlock the queue, but **log** the failure. Do not retry automatically.

---

## Files to change

| File | Change |
|---|---|
| `src/lib/local/durable-write.ts` | **Create.** `writeFileDurable(path, data: string \| Uint8Array)` |
| `src/lib/local/store.ts` | Use it. Fail closed on corrupt JSON. Queue import + first boot. Stop write-on-read except ENOENT. |
| `src/lib/local/images.ts` | Durable image write. |
| `src/app/error.tsx` | German copy for `StoreCorruptError` if the error reaches the boundary. |
| `src/lib/local/errors.ts` | **Create.** `StoreCorruptError` with `backupPath?: string`. |
| `docs/local-pi-deployment.md` | Document: corrupt file is not auto-wiped; how to restore from `.bak` / `.corrupt.*` / Profile backup. |

---

## Edge cases

- **Two Node processes on one `DATA_DIR`:** in-process queue still does not help. Out of scope to add `flock` unless cheap (`fs.open` + `fsync` does not replace a lock). Document “one process only” in the deploy doc. Optional: try `proper-lockfile` later (Phase 11).
- **Cross-device rename:** `DATA_DIR` on a mounted USB vs tmp on root. Temp file must be in the **same directory** as the target (already true: `${targetPath}.tmp.{uuid}`).
- **Windows:** not a target. fsync + rename is POSIX/Pi.
- **Very large store:** pretty-printed JSON of hundreds of recipes is still fine. Do not switch to sqlite here.
- **Partial image:** old `{id}.webp` remains until new rename succeeds.

---

## Implementation steps (ordered)

1. Add `durable-write.ts` with tests-of-thought: write, crash-before-rename leaves `.tmp.*` (harmless leftover; optional startup glob delete of `*.tmp.*`).
2. Point `writeStore` at it. Keep `writeQueue`.
3. Change `readStore`: ENOENT → queued create; SyntaxError / empty / non-object → throw `StoreCorruptError`; success → `normalizeStore` in memory only.
4. Wrap `importStoreJson` in the queue.
5. Durable image writes.
6. German error UI.
7. Docs.
8. `npm run build` && `npm run lint`.
9. Manual: stop the app, truncate `tiptopf.json` to `{`, start app, confirm empty library is **not** written and the UI shows an error. Restore from the corrupt backup.

---

## Acceptance

- Truncated `tiptopf.json` does not become a 5-key empty default.
- `importStoreJson` cannot interleave with `createRecipe` in one process (queue).
- After `writeStore`, pulling power *immediately* still has either old or new complete JSON, not a 0-byte file (best-effort; fsync makes this true on ext4).
- `.tmp.*` leftovers do not break the next boot (ignored; optional cleanup).
- Existing valid `data/tiptopf.json` still loads unchanged.

## Out of scope

- SQLite
- Encrypting the file
- Splitting secrets (Phase 03)
- Image identity (Phase 02) — but the write helper should already be used by Phase 02
