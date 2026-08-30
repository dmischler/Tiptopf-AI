# Tiptopf-AI - Agent Guide

## Verification Commands
- `npm run build` — primary non-interactive verification (includes TypeScript check)
- `npm run lint` — ESLint checks

## Docker
- `docker compose up -d --build` — build and start production container
- `docker compose stop` — stop container (data persists)
- `docker compose down -v` — remove container and all data
- `docker compose logs -f` — follow logs

## Environment Setup
- Native: Copy `.env.example` to `.env.local` before running
- Docker: Copy `.env.docker.example` to `.env.docker` before running
- Required env var: `DATA_DIR`
- Optional: `NEXT_PUBLIC_SITE_URL`

## Architecture
- **Next.js App Router** — primary routes: `/`, `/library`, `/profile`
- **Server Actions** in `src/app/actions/` — `add-recipe.ts`, `extract-recipe.ts`, `recipe.ts`, `collections.ts`, `settings.ts`
- **AI Layer** in `src/lib/ai/` — extraction and model config (default: `big-pickle` on OpenCode Zen; Go subscription supported)
- **Local persistence** in `src/lib/local/` — `paths.ts`, `store.ts`, `images.ts`
- **Image API route** in `src/app/api/images/[imageName]/route.ts`
- **UI components** in `src/components/`

## Runtime Storage
- Store file: `DATA_DIR/tiptopf.json`
- Image files: `DATA_DIR/recipe-images/*`

## Repo Conventions
- Single-user local mode (no in-app auth)
- Access control expected via network layer (Tailscale)
- Categories fixed: starter, main, dessert, side, breakfast, snack
- Difficulty: easy, medium, hard
- URL images are downloaded and persisted locally
- API keys + AI model config (OpenCode for text/URL extraction, Gemini for images) are managed in `/profile` and persisted in local store (currently unencrypted)
- UI language: German

## Code Organization
- Keep UI and backend code separated
- Prefer targeted reads and minimal context usage
- Use `grep`/`glob` to discover before opening large files

## Critical References
- `tasks/POST_REVIEW_HARDENING_PLAN.md` — current hardening plan (phases in `tasks/post-review/`)
- `tasks/completed/LOCAL_PI_OPTION_A_PLAN.md` — completed local-Pi migration
- `docs/local-pi-deployment.md` — deployment and operations guide
- `docs/project_status.md` — version/change log
