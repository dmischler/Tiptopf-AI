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
- Optional: `NEXT_PUBLIC_SITE_URL`, `ACCESS_PIN`, `ALLOW_HTTP_FETCH`

## Architecture
- **Next.js App Router** — routes: `/` (redirects to `/library`), `/library`, `/library/[id]`, `/collections`, `/einkaufsliste`, `/profile`, `/gate`
- **Server Actions** in `src/app/actions/` — `add-recipe.ts`, `extract-recipe.ts`, `recipe.ts`, `collections.ts`, `settings.ts`, `shopping-list.ts`
- **AI Layer** in `src/lib/ai/` — extraction and model config (default: `big-pickle` on OpenCode Zen; Go subscription supported)
- **Local persistence** in `src/lib/local/` — `paths.ts`, `store.ts`, `images.ts`
- **Image API route** in `src/app/api/images/[imageName]/route.ts`
- **UI components** in `src/components/`

## Runtime Storage
- Store file: `DATA_DIR/tiptopf.json` (`schema_version` 3)
- Image files: `DATA_DIR/recipe-images/{recipeId}.webp`
- Deleted images: `DATA_DIR/recipe-images/.trash/{recipeId}.webp` (undo window, then purge)
- One process per `DATA_DIR`

## Repo Conventions
- Single-user local mode (no in-app auth)
- Access control expected via network layer (Tailscale) plus optional `ACCESS_PIN`
- Categories fixed: starter, main, dessert, side, breakfast, snack
- Difficulty: easy, medium, hard (German labels: Einfach / Mittel / Schwer)
- URL images are downloaded and persisted locally as `{id}.webp`
- API keys + AI model config (OpenCode for text/URL extraction, Gemini for images) are managed in `/profile` and persisted in local store (currently unencrypted; default backup strips keys)
- `/profile` is title + API settings + backup (no dummy user card)
- UI language: German (**du**)
- Dark-only; pinch-zoom stays disabled (`maximumScale: 1`)

## Code Organization
- Keep UI and backend code separated
- Prefer targeted reads and minimal context usage
- Use `grep`/`glob` to discover before opening large files

## Critical References
- `tasks/POST_REVIEW_HARDENING_PLAN.md` — current implementation plan (phases in `tasks/post-review/`)
- `docs/local-pi-deployment.md` — deployment and operations guide
- `docs/project_status.md` — version/change log
- `tasks/completed/LOCAL_PI_OPTION_A_PLAN.md` — completed local-Pi migration (historical)
