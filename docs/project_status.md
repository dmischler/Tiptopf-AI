# Project Status

## v0.8.0 - Expandable FAB & Manual Recipe Entry
- Replaced separate add/random FABs with a single expandable speed-dial FAB (`src/components/add-recipe/expandable-fab.tsx`):
  - Options: Zufallsrezept, Manuell, URL, Bild
  - Mobile-only random recipe option (desktop has header button)
  - Pure CSS transitions, no new dependencies
- Added manual recipe form (`src/components/add-recipe/manual-form.tsx`):
  - Full form: title, ingredients (textarea), instructions (textarea), prep/cook time, servings, category, difficulty
  - Chip-style tag input with autocomplete from existing tags
  - Image upload or Pexels search (disabled until title + category filled)
- Extended `AddRecipeModal` with a third "Manuell" tab and `initialMode` prop
- Updated `saveRecipe` action to accept `source_type: 'manual'`
- Deleted obsolete components: `src/components/add-recipe/fab.tsx`, `src/components/library/random-recipe-fab.tsx`

## v0.7.0 - Local Pi Mode (Option A)
- Migrated runtime architecture from Supabase to local filesystem persistence.
- Added local storage modules:
  - `src/lib/local/paths.ts`
  - `src/lib/local/store.ts`
  - `src/lib/local/images.ts`
- Added local image API route: `src/app/api/images/[imageName]/route.ts`.
- Reworked server actions to use local data and image storage:
  - `src/app/actions/add-recipe.ts`
  - `src/app/actions/extract-recipe.ts`
  - `src/app/actions/profile.ts`
  - `src/app/actions/recipe.ts`
- Removed Supabase runtime dependencies and auth action flow:
  - deleted `src/lib/supabase/*`
  - deleted `src/app/actions/auth.ts`
  - deleted `src/proxy.ts`
- Simplified routing for no-auth mode:
  - `/` now redirects to `/library`
  - `/login`, `/signup`, `/forgot-password`, `/reset-password` redirect to `/library`
- Updated profile page for single-user local/Tailscale model.
- Updated configuration/docs:
  - removed Supabase packages from `package.json`
  - updated `.env.example`
  - updated `README.md`
  - added `docs/local-pi-deployment.md`
  - added migration plan `tasks/LOCAL_PI_OPTION_A_PLAN.md`
