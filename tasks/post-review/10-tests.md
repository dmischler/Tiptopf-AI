# Phase 10 — Tests that lock the new invariants

**Status:** NOT STARTED  
**Depends on:** 01–09 behavior in place (write tests against the new contracts, not the old bugs)  
**Goal:** Automated coverage for the failures the review found. Not a general testing religion.

---

## Why

`e2e/app.spec.ts` only checks `/` → `/library` and the heading “Deine Bibliothek”. `tests/` is empty. No unit runner in `package.json` besides Playwright.

The riskiest flows (extract, save+image, delete+undo identity, backup, shopping add-then-toggle, image path traversal, scaling) have zero tests.

---

## Tooling

Keep it small.

| Layer | Tool | Notes |
|---|---|---|
| Unit | Node built-in `node:test` + `tsx` **or** add `vitest` | Prefer **vitest** if we want path aliases `@/` without pain. If adding a dep is undesirable, a `tsx` + `node:test` script that only tests `src/lib/**` is enough. |
| E2E | existing Playwright | Extend `e2e/app.spec.ts`; use a temp `DATA_DIR` |

`package.json` scripts:

```
"test": "vitest run"
"test:watch": "vitest"
"e2e": "playwright test"   # already
```

Do not introduce Cypress. Do not mock AI providers in unit tests except with a fake `safeFetch`.

E2E that would call real OpenCode/Gemini is **out of scope** (cost, keys). Cover everything else.

---

## Unit tests (highest ROI)

### `src/lib/ingredient-scaling.ts`

Table tests:

| Input | Servings from→to | Expect |
|---|---|---|
| `150 g Mehl` | 2→4 | `300 g Mehl` |
| `2 Eier` | 2→4 | `4 Eier` |
| `1 1/2 TL Salz` or `1½ TL Salz` | 2→4 | doubled |
| `2-3 EL Zucker` | 2→4 | range doubled |
| line without amount | any | unchanged |

Assert `Eier` is **not** treated as a unit token.

### `src/lib/shopping.ts` `reorderShoppingList`

Unchecked stay above checked; relative order preserved.

### `src/lib/http/safe-fetch.ts` (or a pure `assertPublicUrl`)

Export the URL/IP policy as a pure function `assertSafeHttpUrl(url)` for tests:

- `http://127.0.0.1/x` reject
- `http://192.168.1.1/x` reject
- `http://169.254.169.254/` reject
- `file:///etc/passwd` reject
- `https://example.com/recipe` accept (no DNS in unit test — split hostname checks vs lookup; mock lookup)

### `src/lib/local/images.ts` `isSafeImageName` / path prefix

- `../x` invalid
- `uuid.webp` valid
- `%2e%2e` after decode invalid

### `src/lib/local/store.ts` (integration with temp dir)

Set `DATA_DIR` to `os.tmpdir()` per test.

| Test | Expect |
|---|---|
| create + delete + upsert same id | id preserved; collections pruned on delete |
| import while a queued create is in flight | no lost update (serialize) |
| corrupt JSON read | throws `StoreCorruptError`; file not replaced with empty default |
| `save` image_url `data:image/png;base64,xx` | rejected |
| delete cascade | collection `recipe_ids` no longer contains id |

These tests need filesystem; keep them in `src/lib/local/store.test.ts`.

### `src/lib/ai/url-fetcher.ts` parse-only

Feed a fixture HTML string (do not network):

- JSON-LD Recipe → structured fields
- `@type` object skipped, no throw
- relative `og:image` resolved with a base URL helper (export `resolveMaybeUrl`)

---

## Playwright e2e (no AI keys required)

Use `DATA_DIR` pointing at a fixture directory copied per test. Seed `tiptopf.json` with 2 recipes + 1 collection + empty shopping list. **No API keys** in the fixture.

| Spec | Steps | Expect |
|---|---|---|
| `library-loads` | goto `/library` | heading visible (existing) |
| `recipe-page` | click first card | URL `/library/{uuid}`; title visible; **not** a dialog-only overlay; browser `page.goBack()` returns to library |
| `print-css` | optional; hard to assert print. Skip or check `data-print-root` exists on recipe page |
| `shopping-add-toggle` | goto einkaufsliste; add “Milch”; check it | stays checked; reload still checked |
| `delete-undo-id` | open recipe; delete; undo | URL or library still shows **same** id (compare id from URL before delete) |
| `manual-add` | FAB → Manuell → title+ingredient+instructions → save | lands on `/library/{id}`; appears in grid after back |
| `backup-export-no-keys` | seed store **with** a fake key; profile export | downloaded JSON `opencode_api_key` null (if Phase 03 default strip). If Playwright cannot read download easily, unit-test `exportStoreJson` instead |
| `collection-opens-recipe` | collections → card | `/library/{id}`, not stub text “In Bibliothek öffnen” |
| `image-traversal` | `request.get('/api/images/..%2F..%2Fetc')` | 400 |
| `zoom-disabled` | evaluate `document.querySelector('meta[name=viewport]').content` | contains `maximum-scale=1` |

Add `e2e/helpers/seed.ts` to write a temp store. `playwright.config.ts`: `env: { DATA_DIR: ... }` for the webServer.

Do **not** e2e camera/Gemini.

---

## What not to test

- Visual snapshot of masonry
- OpenCode/Gemini live
- Docker
- Tailwind class strings
- Every German string

---

## Implementation steps

1. Add vitest (or node:test) + `test` script. One scaling test file green.
2. Store tests with temp DATA_DIR.
3. `assertSafeHttpUrl` tests.
4. Playwright seed helper + recipe page + shopping + delete-undo + traversal + viewport meta.
5. CI note in README: `npm test && npm run e2e` locally. Do not add GitHub Actions unless already present.

---

## Acceptance

- `npm test` fails if delete+upsert changes recipe id.
- `npm test` fails if corrupt JSON is overwritten with an empty default (use a fixture file).
- `npm run e2e` covers recipe URL, shopping add-toggle, image 400 on traversal, viewport maximum-scale=1.
- `e2e/app.spec.ts` is not the only spec.

## Out of scope

- 80% coverage gates
- Testing Library component tests for every dialog
- Mocking the entire Next server action layer
