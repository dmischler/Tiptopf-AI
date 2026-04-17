# Project Status

## v0.1.0 - Phase 0 Setup
- Installed and locked project dependencies with npm.
- Initialized shadcn/ui and added core UI primitives used by upcoming phases.
- Added a critical plan review section in `tasks/IMPLEMENTATION.md` to keep the implementation practical.
- Verified with `npm run build`.

## v0.2.0 - Phase 1 Supabase Schema
- Added a reproducible migration SQL file at `supabase/migrations/202604170001_phase1_schema.sql`.
- Implemented `recipes` and `profiles` schema, indexes, constraints, profile-on-signup trigger, and `updated_at` triggers.
- Added explicit RLS policies for app tables and storage policies for `recipe-images` bucket.
- Updated `tasks/PHASE-1-supabase.md` with implementation notes and current verification state.

## v0.3.0 - Phase 2 Auth Foundation
- Added Supabase SSR clients and middleware route protection (`src/lib/supabase/*`, `src/middleware.ts`).
- Implemented auth pages and server actions for sign in, sign up, password reset, and sign out.
- Added profile page with theme toggle and encrypted API key storage flow.
- Added `src/lib/crypto.ts` and integrated browser-side API key encryption before DB save.
- Added root redirect (`/`) and a temporary protected `/library` page placeholder.
- Verified with `npm run build`; updated `tasks/PHASE-2-auth.md` verification notes.

## v0.4.0 - Phase 3 AI Service Layer
- Added AI service modules for prompts, model resolution, text extraction, URL fetching, and image extraction.
- Added server action wrappers for URL and image recipe extraction in `src/app/actions/extract-recipe.ts`.
- Implemented JSON-LD recipe parsing with HTML fallback and optional image import into Supabase storage.
- Added environment-based model override support (`OPENCODE_MODEL_ID`) with default `MiniMax-M2.7`.
- Verified compilation with `npm run build`; updated `tasks/PHASE-3-ai-service.md` verification notes.
