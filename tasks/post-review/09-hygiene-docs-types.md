# Phase 09 — Hygiene: types, dead code, docs

**Status:** COMPLETED  
**Depends on:** 04–08 should be mostly done so docs describe the real app  
**Goal:** One architecture in the repo. Types, folders, and docs match local Pi single-user mode.

---

## Why

The live app is local JSON + Tailscale. The tree still contains:

- Empty auth route dirs (`src/app/login`, `signup`, `forgot-password`, `reset-password`) — 404, not redirects (`docs/project_status.md` still claims they redirect)
- Empty `src/components/auth/`, `src/hooks/`
- `supabase/config.toml` + `supabase/migrations/202604170001_phase1_schema.sql` (multi-user RLS, no tags/collections/shopping)
- `Recipe.user_id` and dummy `Profile` (`local-device` / `local@tiptopf.local`) shown on `/profile`
- `VISION.md` still describes Supabase, Vercel, encrypted keys, auth, masonry-css, light toggle
- `docs/project_status.md` cites `src/app/actions/profile.ts` (does not exist)
- `AGENTS.md` points at `tasks/LOCAL_PI_OPTION_A_PLAN.md` (now under `completed/`)
- `skills-lock.json` may still list supabase skills — only change if it is actually unused config
- Unused `AddRecipeLauncher`, `SIMPLIFIED_IMAGE_PROMPT` (07), `saveRecipeImageBytes` if still unused
- Settings still special-case `gemini_image_*` with `as any` (`store.ts:535-544`)
- `updateSettings` input `Partial<AppSettings> & Record<string, unknown>`

---

## 1. Types: drop multi-user lie

### `Recipe`

Remove `user_id`. Migration: `normalizeRecipe` ignores it; writes omit it. `schema_version` bump to 3 if 02 used 2 for images.

### `Profile`

Remove from `LocalStore` and `/profile` page. Profile page is: title, API settings, backup. No fake email/id card (`profile/page.tsx:19-27`).

If a display name is wanted later, that is a new field, not `local@tiptopf.local`.

### `AppSettings`

Keep. Secrets split/strip is Phase 03. Remove `gemini_image_model_id` alias once migrated (`normalizeSettings` can still read old keys on the way in, never write them). Delete `as any`.

### `ShoppingListItem`

Optional: add `sourceRecipeId?: string` if Phase 08 did it. Normalize snake/camel: pick **camelCase** as written today (`addedAt`) **or** snake_case to match recipes. Do not mix further. Document the choice in `store.ts`.

---

## 2. Delete dead trees

```
src/app/login/
src/app/signup/
src/app/forgot-password/
src/app/reset-password/
src/components/auth/
src/hooks/                  # if still empty
src/components/add-recipe/launcher.tsx
supabase/                   # move SQL to docs/archive/ if you want history; default DELETE
```

If anything still imports these, fix the import first (grep).

Do **not** add redirect pages “for compatibility.” Nothing should link to `/login`.

---

## 3. Store leftovers

- `LOCAL_PROFILE_ID` / `LOCAL_PROFILE_EMAIL` / `createDefaultProfile` / `normalizeProfile` / `getProfile` — delete with Profile.
- `getProfile()` callers: only `profile/page.tsx`.
- `exportStoreJson` / import: no `profile` key. Import of old backups: ignore `profile`.
- `updateSettings` signature: `Partial<AppSettings>` only.

---

## 4. Docs to rewrite

### `VISION.md`

Rewrite sections that are false:

- Multi-user / Supabase / Vercel / encrypted keys / auth flows → local Pi, Tailscale, JSON/SQLite-later, keys in profile (unencrypted, stripped from backup)
- Recipe overlay → recipe **pages**
- Light toggle → dark-only (until Phase 11)
- Masonry-css → CSS grid (until Phase 11)
- Keep: German, dark amber, categories, camera+URL, single household library

Do not leave “Status: Ready to build” for 2026-04-17 MVP as if it were current.

### `docs/project_status.md`

Add a new version heading for this hardening work when it ships. Fix false claims (auth redirects, `actions/profile.ts`). Point at `tasks/POST_REVIEW_HARDENING_PLAN.md`.

### `docs/local-pi-deployment.md`

Should already have been patched in 01–03 (corrupt JSON, bind modes, backups, `{id}.webp`). Re-read end-to-end. Add:

- one process per DATA_DIR
- `.trash` image undo if 02 implemented it
- ACCESS_PIN
- backup without keys

### `AGENTS.md`

Critical references:

```
- tasks/POST_REVIEW_HARDENING_PLAN.md — current implementation plan
- docs/local-pi-deployment.md
- docs/project_status.md
```

Remove or mark `tasks/LOCAL_PI_OPTION_A_PLAN.md` as completed path: `tasks/completed/LOCAL_PI_OPTION_A_PLAN.md`.

Architecture list: add `/einkaufsliste`, `/collections`, `/library/[id]`. `shopping-list.ts` action.

### `README.md`

Match local Pi, German UI, no Supabase setup.

### `tasks/IMPLEMENTATION.md`

Already should point here (updated when this plan was added). Confirm.

### `tasks/Architecture_Improvements.md`

Add a note at top: historical Phase 2–3 addendum; current work is POST_REVIEW_HARDENING_PLAN. Do not rewrite the whole addendum.

---

## 5. Small code hygiene

| Item | Action |
|---|---|
| `'use client'` on `masonry-grid.tsx` / `streaming-progress.tsx` with no hooks | Remove directive if parent is already client; or keep if imported from server later — after 04, grid is client-only, OK |
| `library/page.tsx` `as Recipe[]` | Delete casts |
| English comments that narrate history | Do not mass-rewrite comments. Only delete misleading ones you touch. |
| `Dockerfile` copies full node_modules into standalone | Optional slim; mention if easy |
| Duplicate manifests | Phase 06 |
| `next.config.js` 20mb action body | Keep for image extract data URLs; do not raise |

---

## Implementation steps

1. Grep `user_id`, `getProfile`, `LOCAL_PROFILE`, `from '@/components/auth'`, `supabase`.
2. Type + store + profile page changes. Migrate schema_version.
3. Delete empty dirs and supabase.
4. Rewrite VISION + AGENTS + project_status + README.
5. `npm run build` (will fail if a page still imports Profile).
6. Grep `Leicht`, `local@tiptopf`, `Add recipe` — should already be gone from 05–06.

---

## Acceptance

- No `user_id` in `src/types` or new writes to `tiptopf.json`.
- `/profile` has no fake email/id.
- `ls src/app/login` fails.
- No `supabase/` directory (or only `docs/archive/`).
- `VISION.md` does not mention Supabase as the live database.
- `AGENTS.md` points at this plan.
- Build passes.

## Out of scope

- SQLite
- Encrypting keys
- New marketing site / landing page
