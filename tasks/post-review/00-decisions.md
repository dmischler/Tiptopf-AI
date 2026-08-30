# Phase 00 — Decisions, invariants, and working agreements

**Status:** LOCKED  
**Depends on:** nothing  
**Produces:** the rules every later phase must obey  

This phase is documentation only. Do not start coding until these are treated as constraints.

---

## 1. Product invariants

### 1.1 Zoom stays disabled

**Keep** in `src/app/layout.tsx`:

```ts
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // REQUIRED — do not remove
  viewportFit: 'cover',
  themeColor: '#0f0f0f',
}
```

Rationale: this is a cook-at-the-counter app. Accidental pinch on greasy glass is worse than missing WCAG 1.4.4. The review flagged zoom as a kitchen blocker; the owner overruled it.

**Compensation (Phase 06, not optional):** if users cannot pinch-zoom, the recipe page must be readable at default scale.

- Instruction steps: at least `text-base` on mobile, `text-lg` preferred for the step body.
- Ingredient lines: at least `text-base`.
- Title: stay large (`text-2xl` / `text-3xl`).
- All primary controls (servings +/−, shopping check, delete, nav, FAB actions): **minimum 44×44 CSS pixels**.
- Do not put essential recipe text in `text-xs` / `text-[10px]` except decorative chips.
- Do not rely on hover-only affordances for anything a cook needs.

If a later change makes text smaller to “fit more on screen”, that change is a regression against this decision.

### 1.2 Single-user local mode

- No login, signup, session, or RLS.
- Anyone who can complete TCP to the process is the owner. Phase 03 hardens the network and adds an *optional* shared pin, not accounts.
- Dummy `Profile` / `user_id` are deleted in Phase 09, not replaced with real users.

### 1.3 Persistence

- Canonical store file: `DATA_DIR/tiptopf.json` until Phase 11.
- Canonical images dir: `DATA_DIR/recipe-images/`.
- After Phase 02, image contract is `{recipeId}.webp` and `recipe.image_url === /api/images/{recipeId}.webp`.
- After Phase 03, API keys are not in recipe backups. Prefer a sibling `DATA_DIR/secrets.json` (mode `0600`) or a `settings` object that export strips. See Phase 03.

### 1.4 UI language and address

- All user-visible strings: German.
- Informal **du** (“Willst du…”, never “Sind Sie sicher”).
- Canonical difficulty labels: `Einfach`, `Mittel`, `Schwer`. Filter bar currently says `Leicht` — fix in Phase 05/06.
- Errors shown in toasts/actions: German. Do not leak raw Zod English to the UI (map in the action or a helper).

### 1.5 Layout philosophy

- Mobile-first CSS: unprefixed styles are the phone layout; `md`/`lg` enhance.
- Adaptive, not “mobile-only stretched on desktop”.
- Recipe **view** is a route (Phase 04). Add-recipe is a sheet on small screens, modal on `md+` (Phase 06).
- One breakpoint table (Phase 06). Stop using `max-width: 639px` in JS while nav uses `md` (768px).

---

## 2. Architecture invariants

### 2.1 Store writes

Every mutation of `tiptopf.json`, including:

- first-boot create
- backup import
- settings update
- shopping toggles

must go through `runMutatingStoreOperation` (or a successor that still serializes + durable-writes).

`writeStore` must: write temp file → `fsync` file → `rename` → `fsync` directory. Phase 01.

Corrupt JSON: **never** replace the live file with an empty default. Phase 01.

### 2.2 Recipe identity

`createRecipe` may take an optional `id`. Restore/undo must pass the original id.

`deleteRecipe` in the same queued operation:

1. Remove the recipe row.
2. Strip that id from every `collection.recipe_ids`.
3. Return the removed recipe (for undo) plus image path info.

Image file deletion can happen after the JSON write succeeds, using both `{id}.*` and the basename of `image_url`.

### 2.3 Server actions are the only RPC

- Do not put `'use server'` on files under `src/lib/`.
- `src/lib/ai/image-handler.ts` must become a plain module (Phase 07).
- Callers never pass API keys from the client into lib functions as a public action. Actions load settings on the server.

### 2.4 Validation

- Recipe ids and collection ids at action boundaries: `z.string().uuid()`.
- `uploadRecipeImage` recipeId: UUID + resolved-path prefix check (Phase 03).
- Shared Zod recipe field schemas live in one module (Phase 05/07), imported by actions and AI.

### 2.5 Revalidation

Introduce `revalidateApp()` in e.g. `src/app/actions/_revalidate.ts`:

```ts
revalidatePath('/library')
revalidatePath('/collections')
revalidatePath('/einkaufsliste')
revalidatePath('/profile')
```

Plus `revalidatePath('/library/[id]', 'page')` and `revalidatePath('/collections/[id]', 'page')` after Phase 04.

Call it from mutations instead of remembering one path.

---

## 3. Code-judo working agreements

When implementing a phase:

- Prefer deleting a layer over adding a helper around it.
- Do not grow `recipe-detail.tsx`. Phase 04/05 split it; afterwards the old file should not exist.
- Do not add a fourth copy of `CATEGORY_LABELS`. Canonical module: `src/lib/recipe-meta.ts` (Phase 05).
- Do not persist `data:` URLs. `saveRecipe` rejects anything that is not `null` or `/api/images/{uuid}.webp` (Phase 02).
- Do not invent streaming UI. Extraction is one await. `StreamingProgress` is a progress indicator, not a token stream. Rename copy in Phase 06.

---

## 4. Current hot spots (do not “just add a bit more”)

| File | Lines (approx) | Fate |
|---|---|---|
| `src/components/library/recipe-detail.tsx` | 1561 | Split then delete (Phases 04–05) |
| `src/lib/local/store.ts` | 765 | Keep, but tighten writes / upsert / cascade (01–02) |
| `src/components/add-recipe/modal.tsx` | 564 | Keep as host; share fields with edit (05–06) |
| `src/components/add-recipe/manual-form.tsx` | 457 | Become a consumer of shared `RecipeFields` |
| `src/components/add-recipe/preview.tsx` | 412 | Same |
| `src/lib/ai/url-fetcher.ts` | 397 | Keep JSON-LD parser; stop treating it as final recipe (07) |

---

## 5. Canonical new / shared modules to introduce

Create these when the first phase that needs them runs, not earlier.

| Module | First needed | Responsibility |
|---|---|---|
| `src/lib/local/durable-write.ts` | 01 | temp + fsync + rename for JSON (and optionally images) |
| `src/lib/recipe-meta.ts` | 05 | categories, difficulties, German labels, colors |
| `src/lib/recipe-schema.ts` | 02/07 | shared Zod for recipe fields |
| `src/lib/http/safe-fetch.ts` | 03/07 | timeout, max bytes, deny private IPs, https (http optional) |
| `src/app/actions/_revalidate.ts` | 02 | `revalidateApp()` |
| `src/components/recipe/recipe-fields.tsx` | 05 | shared form fields |
| `src/components/recipe/tags-editor.tsx` | 05 | shared tags UI |
| `src/components/recipe/image-picker.tsx` | 05 | search + upload + apply |
| `src/app/library/[id]/page.tsx` | 04 | recipe view route |
| `src/app/library/[id]/edit/page.tsx` | 04 | recipe edit route (or edit mode on the same page — see Phase 04) |

---

## 6. Files that must eventually disappear

| Path | Phase |
|---|---|
| `src/app/login/` (empty) | 09 |
| `src/app/signup/` | 09 |
| `src/app/forgot-password/` | 09 |
| `src/app/reset-password/` | 09 |
| `src/components/auth/` | 09 |
| `src/hooks/` if still empty | 09 |
| `src/components/add-recipe/launcher.tsx` (unused) | 09 |
| `supabase/` | 09 |
| Duplicate `CATEGORY_LABELS` blocks | 05 |
| `SIMPLIFIED_IMAGE_PROMPT` | 07 |
| AI-image toast / `'ai'` source with no producer | 05/07 |

---

## 7. Testing and verification agreement

- After every phase: `npm run build` (required), `npm run lint`.
- Do not add features in a durability/security phase.
- Manual kitchen check after Phase 04 and 06: phone-sized viewport (360–430px), iOS safe-area simulation, landscape short height, desktop `lg`.
- Browser tools if a UI phase: exercise the flow, do not screenshot-only.

---

## 8. Migration safety for existing Pi data

Live stores already have:

- recipes with `user_id: "local-device"`
- `image_url` pointing at **random UUID** filenames, not `recipe.id`
- old settings keys `gemini_image_model_id` / `gemini_image_fallback_model_id`
- API keys in the same JSON as recipes

Phase 02 must migrate existing files on first read/write (rename image files, rewrite `image_url`). Phase 09 drops `user_id` after a normalize that ignores it. Phase 03 splits or strips secrets on export.

Never ship a build that cannot boot on the current `data/tiptopf.json` shape.

---

## Acceptance

- This file and the master plan are the source of truth for Phases 01–11.
- `VISION.md` is **not** the source of truth until Phase 09 updates it.
- Zoom remains disabled for the entire plan.
