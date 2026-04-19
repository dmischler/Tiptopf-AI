# Tiptopf-AI

Local-first, AI-powered recipe library for a Raspberry Pi.

This version runs without Supabase. It stores recipes and profile settings on local disk and is designed to be accessed remotely through Tailscale.

## What changed

- No app authentication flow (Option A): `/` and auth routes redirect to `/library`
- Local JSON data store at `DATA_DIR/tiptopf.json`
- Local image storage at `DATA_DIR/recipe-images`
- Image serving route: `/api/images/[imageName]`

## Getting started

1. Clone the repository
2. Copy `.env.example` to `.env.local`
3. Set `DATA_DIR` in `.env.local` (example: `./data`)
4. Install dependencies:

```bash
npm install
```

5. Run development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Required environment variables

- `DATA_DIR` — directory where local database file and images are stored

## Optional environment variables

- `NEXT_PUBLIC_SITE_URL` — useful when behind a reverse proxy
- `OPENCODE_MODEL_ID` — override default model identifier

## Local data layout

When `DATA_DIR=./data`, the runtime storage looks like:

```text
data/
  tiptopf.json
  recipe-images/
    <recipe-id>.jpg|png|webp
```

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Vercel AI SDK
- Local filesystem persistence (JSON + image files)

## Verification

```bash
npm run build
npm run lint
```

## Notes

- API keys are still encrypted in the browser before being saved.
- Image uploads from URL are downloaded and persisted locally.
- For deployment details on Raspberry Pi and Tailscale, see `docs/local-pi-deployment.md`.
