# Local-Only Raspberry Pi Migration Plan (Option A: No App Auth)

## Goal
Run Tiptopf-AI entirely on a Raspberry Pi without Supabase.
Access control is handled by Tailscale network access, not by in-app login.

## Scope
- Remove Supabase Auth, Database, Storage, and related middleware usage.
- Replace persistence with local filesystem storage.
- Keep the existing recipe and profile UX where possible.
- Keep AI extraction flow and API key encryption behavior.

## Architecture Changes

### Data Layer
- Introduce local JSON persistence for `recipes` and `profile`.
- Store data in `DATA_DIR` (default: `./data`) as `tiptopf.json`.
- Keep recipe fields aligned with existing `Recipe` type for UI compatibility.

### Image Layer
- Store images on disk in `DATA_DIR/recipe-images`.
- Replace Supabase Storage uploads with filesystem writes.
- Serve images through `GET /api/images/[imageName]` route.

### Auth Layer
- Remove Supabase auth checks from server actions/pages.
- Remove login/signup/reset-password flows for Option A.
- Redirect auth routes to `/library` to avoid broken links during transition.

### Profile / API Key Layer
- Keep one local profile record.
- Continue encrypting API key client-side using Web Crypto.
- Persist encrypted API key and AI base URL in local storage file.

## Implementation Steps

1. Add local persistence modules under `src/lib/local/`:
   - `paths.ts` (data/image paths)
   - `store.ts` (recipe/profile CRUD)
   - `images.ts` (save/read/download helpers)
2. Add image serving API route: `src/app/api/images/[imageName]/route.ts`.
3. Rewrite server actions:
   - `src/app/actions/add-recipe.ts`
   - `src/app/actions/extract-recipe.ts`
   - `src/app/actions/profile.ts`
   - `src/app/actions/recipe.ts`
4. Remove auth runtime dependency:
   - replace `src/app/page.tsx` with redirect to `/library`
   - redirect `login/signup/forgot-password/reset-password` routes to `/library`
   - simplify `src/app/profile/page.tsx` to local profile mode
5. Remove Supabase wiring and packages:
   - delete `src/lib/supabase/*`
   - delete `src/proxy.ts`
   - remove Supabase deps from `package.json`
   - update `next.config.js` and env examples
6. Documentation update:
   - rewrite `README.md` for local Raspberry Pi usage
   - add full deployment/operations doc in `docs/`
   - update `docs/project_status.md`
7. Verify:
   - run `npm install` (lockfile sync)
   - run `npm run build`
   - run `npm run lint`

## Acceptance Criteria
- App runs without Supabase env vars.
- `/library` loads and persists recipes across restarts.
- URL and replacement images are persisted and displayed via local image route.
- Profile page saves encrypted API key and base URL locally.
- No source imports from `@supabase/*` or `@/lib/supabase/*` remain.
