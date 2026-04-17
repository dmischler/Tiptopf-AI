# Tiptopf-AI - Agent Guide

## Verification Commands
- `npm run build` — primary non-interactive verification (also runs TypeScript check)
- `npm run lint` — ESLint (can prompt for config on fresh Next.js projects; if stuck, add `eslint.config.mjs` manually)

## Environment Setup
- Copy `.env.example` to `.env.local` before running
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Optional: `OPENCODE_MODEL_ID` to override default `MiniMax-M2.7`

## Architecture
- **Next.js 15 App Router** — routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/profile`, `/library`
- **Server Actions** in `src/app/actions/` — `add-recipe.ts`, `extract-recipe.ts`, `auth.ts`, `profile.ts`
- **AI Layer** in `src/lib/ai/` — `client.ts`, `extractor.ts`, `url-fetcher.ts`, `image-handler.ts`, `prompts.ts`
- **Supabase SSR** in `src/lib/supabase/` — `client.ts`, `server.ts`, `middleware.ts`
- **shadcn/ui** components in `src/components/ui/` — use `components.json` config, style `base-nova`
- **App-specific components** in `src/components/{add-recipe,auth,library,profile,interactions}/`

## Database
- Schema in `supabase/migrations/202604170001_phase1_schema.sql`
- Tables: `recipes` (user_id, title, ingredients jsonb, instructions, times, category, difficulty, rating, is_favorite, image_url, source_url, source_type), `profiles` (id, email, encrypted_api_key, api_base_url)
- RLS enabled — users only access their own rows
- Storage bucket `recipe-images` for recipe images

## Repo Conventions
- Theme stored in **localStorage only** (device-specific, no DB sync)
- Categories are **fixed dropdown**: starter, main, dessert, side, breakfast, snack
- Difficulty: easy, medium, hard
- **Phone images are temporary** — discarded after text extraction; user can upload replacement
- **URL images are downloaded** to Supabase Storage for persistence
- API key encrypted client-side using Web Crypto API (AES-GCM + PBKDF2) before saving to `profiles` table
- `source_type`: 'image' | 'url' | 'manual'

## Supabase Skills
Two skills are installed locally in `.agents/skills/` and referenced via `skills-lock.json`. Use the `supabase` skill for any Supabase/Auth/RLS/Postgres work.

## Code Organization
- Target ~250 lines per file; split larger files at natural boundaries
- **UI and backend must always be separated** — never mix server logic (actions, API routes) with UI components in the same file
- **Context is the most important resource** — guard it jealously
- Prune aggressively based on context window usage: prefer targeted reads over broad searches, close unneeded files from context, summarize or defer large file reads when possible
- When context is running low: use `grep`/`glob` instead of reading full files, prefer "research then implement" separation, defer reading large reference files until needed
- Keep tool calls tight and purposeful — unnecessary reads burn context

## Critical Implementation References
- `tasks/IMPLEMENTATION.md` — file structure, key decisions, success criteria
- `VISION.md` — full project vision, tech decisions, database schema
- `docs/project_status.md` — version history and verification notes per phase
