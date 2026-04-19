# Tiptopf-AI - Agent Guide

## Verification Commands
- `npm run build` — primary non-interactive verification (includes TypeScript check)
- `npm run lint` — ESLint checks

## Environment Setup
- Copy `.env.example` to `.env.local` before running
- Required env var: `DATA_DIR`
- Optional: `NEXT_PUBLIC_SITE_URL`, `OPENCODE_MODEL_ID`

## Architecture
- **Next.js App Router** — primary routes: `/`, `/library`, `/profile`
- **Server Actions** in `src/app/actions/` — `add-recipe.ts`, `extract-recipe.ts`, `profile.ts`, `recipe.ts`
- **AI Layer** in `src/lib/ai/` — extraction and model config
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
- API key encrypted client-side before persistence

## Code Organization
- Keep UI and backend code separated
- Prefer targeted reads and minimal context usage
- Use `grep`/`glob` to discover before opening large files

## Critical References
- `tasks/LOCAL_PI_OPTION_A_PLAN.md` — migration implementation plan
- `docs/local-pi-deployment.md` — deployment and operations guide
- `docs/project_status.md` — version/change log
