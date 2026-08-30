# Phase 07 — URL extract pipeline (JSON-LD is input, not output)

**Status:** COMPLETED  
**Depends on:** 03 (`safe-fetch` exists), 02 (images persist on save, not during extract)  
**Goal:** A URL always yields a German, metric, numbered-step recipe when AI is configured. Fetch is bounded and not SSRF. Image-handler is a normal lib module.

---

## Why

`extractFromUrlAction` (`extract-recipe.ts:113-134`):

```
if (structuredRecipe from JSON-LD) return it
else run OpenCode with URL_EXTRACTION_PROMPT
```

JSON-LD is the **common path** for real recipe sites. That path:

- Leaves title/ingredients/instructions in the **source language**
- Infers category with English regex (`cake|dessert|breakfast|...`) (`url-fetcher.ts:119-142`)
- Infers difficulty with English words (`url-fetcher.ts:145-166`)
- Hardcodes `confidence: 0.92` (`:247`)
- Skips metric conversion and numbered German steps from `prompts.ts:17-29`

Relative `image` / `og:image` URLs are not resolved against the page URL (`url-fetcher.ts:314-353`). Download failures are swallowed (`extract-recipe.ts:136-144`). `@type` assumed string; expanded JSON-LD objects throw (`url-fetcher.ts:308`).

`image-handler.ts` is `'use server'` in `src/lib/`, uses `generateObject` then JSON.stringify+parse, `model: any`, `as any`. `SIMPLIFIED_IMAGE_PROMPT` is unused. `extractor.ts` still has `isUrl = false` and an image-from-text path nobody calls.

---

## Target pipeline

```
URL
  → validate + safeFetch (Phase 03) cap 2MB
  → parse JSON-LD / og:image / plaintext fallback  (keep url-fetcher)
  → resolve image URL: new URL(raw, pageUrl)
  → build a TEXT BUNDLE for the model:
        structured fields if any + plaintext
  → ALWAYS call extractRecipeFromText(...) when opencode key present
        unless we add an explicit skip (we do not)
  → ParsedRecipe (German, metric) + remoteImageUrl
  → client preview
  → saveRecipe persists image under recipe.id (Phase 02)
```

If OpenCode key is missing:

- If JSON-LD structured recipe exists: show it with a German warning “Nicht übersetzt — API-Key im Profil fehlt.” Do not pretend it is a finished Tiptopf recipe.
- If no structured recipe: throw the existing “OpenCode API-Key fehlt.”

Do **not** keep the current silent “JSON-LD is good enough” short-circuit.

### Cheap alternative (rejected)

Post-process JSON-LD with regex German/metric without AI. Too incomplete. Always use the model when the key exists.

---

## 1. `url-fetcher.ts` changes

- Export `FetchResult` (today the action inlines a huge type at `extract-recipe.ts:105`).
- `fetchRecipeUrl(url)` uses `safeFetch`.
- Resolve images:

```ts
function resolveMaybeUrl(raw: string | null, base: string): string | null {
  if (!raw) return null
  try { return new URL(raw, base).toString() } catch { return null }
}
```

Use `response.url` / requested URL as base (after redirects; Phase 03 may disable redirects — then the input URL is the base).

- `@type` check: only treat as Recipe if `typeof entry === 'string' && entry.toLowerCase() === 'recipe'`. Skip object types.
- Keep structuredRecipe **as model input**, still returned for fallback when no API key.
- Plaintext fallback: keep, but cap length sent to the model (e.g. 20k chars) even if fetch max is 2MB.
- `inferCategory` / `inferDifficulty`: can stay as fallback for no-key path; AI overwrites when called.

---

## 2. `extractFromUrlAction`

```ts
const parsedUrl = z.string().url().max(2048).parse(url.trim())
// protocol + private IP: safeFetch throws

const fetchResult = await fetchRecipeUrl(parsedUrl)
const settings = await getSettings() // can run in parallel with fetch if key not needed for fetch

if (settings.opencode_api_key) {
  const bundle = buildModelBundle(fetchResult) // JSON-LD dumped as text + content
  recipe = await extractRecipeFromText(bundle, key, base, model, true)
} else if (fetchResult.structuredRecipe) {
  recipe = fetchResult.structuredRecipe
  // flag: untranslated
} else {
  throw new Error('OpenCode API-Key fehlt. Bitte im Profil hinterlegen.')
}

return {
  ...recipe,
  remote_image_url: fetchResult.imageUrl, // not downloaded
  source_url: parsedUrl,
  source_type: 'url',
}
```

`getSettings` and fetch are independent — `Promise.all` if the key is only needed after. Minor.

Remove the `downloadImageToLocalStorage` block from this action (Phase 02). If still present, delete it here.

Zod on the action; map Zod errors to German.

---

## 3. Text extractor

- `extractRecipeFromText(text, key, base, model)` — drop `isUrl` boolean. Always use `URL_EXTRACTION_PROMPT` from this action. Image OCR is Gemini, not this function.
- Delete the `isUrl = false` + `IMAGE_EXTRACTION_PROMPT` branch if nothing else calls it.
- Prefer `generateObject` with `recipeSchema` (already used in image-handler) **or** `generateText` + parse, not both styles. **Code-judo:** one `runStructuredExtraction({ model, system, prompt | messages })` returning `z.infer<typeof recipeSchema>`.
- On parse failure, include a German user message. Do not log full raw response in production; log length + first 200 chars if needed.

Shared schema: merge `extractor.ts` and `image-handler.ts` recipe Zod into `src/lib/ai/recipe-schema.ts`.

---

## 4. Image handler cleanup

- Remove `'use server'`.
- `runImageExtraction` returns `result.object` directly. Delete stringify/parse. Delete unused `getFinishReasonString`.
- Type `model` properly (Google Generative Language model from the SDK). No `as any` on the generate call if the SDK allows `messages` + `schema`. If the SDK type is wrong, a single documented cast at the call site, not `model: any`.
- `extractFromImageAction` validates data URL: mime jpeg/png/webp, size cap (Phase 03). Stay the only RPC; it loads the Gemini key from settings, never from the client argument list as a public action.
- Sequential model fallback can stay; do not treat every error as empty (`return false`). Map 401/429/safety to German errors (review: 401/quota/safety all look the same today).
- Delete `SIMPLIFIED_IMAGE_PROMPT`.
- Delete hardcoded extra fallbacks that ignore user config **or** keep one documented last-resort `gemini-2.0-flash` — comment why.

---

## 5. MealDB / Pexels

- Pexels errors swallowed then MealDB (`extract-recipe.ts:53-57`) — OK.
- MealDB Zod failure throws and aborts search — catch and return `[]` so image search degrades.
- Queries can stay English (`buildImageSearchQuery`) for stock photo APIs.

---

## Files

| File | Change |
|---|---|
| `src/lib/http/safe-fetch.ts` | from Phase 03; use it |
| `src/lib/ai/url-fetcher.ts` | export types, resolve URLs, safe `@type`, cap text |
| `src/lib/ai/recipe-schema.ts` | **Create** shared zod |
| `src/lib/ai/extractor.ts` | no isUrl; shared runner; quieter logs |
| `src/lib/ai/image-handler.ts` | not a server action; generateObject object; typed |
| `src/lib/ai/prompts.ts` | delete SIMPLIFIED; keep German/metric rules |
| `src/app/actions/extract-recipe.ts` | always AI when key; no download; German errors; export FetchResult use |
| `src/lib/ai/meal-db.ts` | catch parse errors |
| `src/types/index.ts` | `ParsedRecipe.remote_image_url?: string \| null` if not added in 02 |

---

## Implementation steps

1. Shared `recipe-schema.ts`. Point both extractors at it. Build.
2. Remove `'use server'` from image-handler; return `result.object`.
3. Wire `extractFromUrlAction` to always AI-when-key; pass JSON-LD as prompt context.
4. Resolve relative images; stop downloading in this action.
5. `@type` guard; plaintext cap.
6. German error mapping.
7. Manual: paste a US recipe URL (schema.org). Preview must be German with ml/g if the model is configured. Cancel → no image file (Phase 02). Missing key + JSON-LD → warning, not silent English save without notice.

---

## Acceptance

- With API key, JSON-LD pages still go through OpenCode. Output language is German (spot-check).
- Without API key, user is told the recipe is untranslated or to add a key.
- `http://127.0.0.1/...` still rejected (Phase 03).
- `image-handler.ts` has no `'use server'`.
- No `SIMPLIFIED_IMAGE_PROMPT`.
- Relative og:image on a site becomes an absolute URL in `remote_image_url`.

## Out of scope

- Streaming tokens into the UI (keep a static progress indicator)
- Implementing real AI image generation
- Changing default models
