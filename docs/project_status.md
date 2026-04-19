# Project Status

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
