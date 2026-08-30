# Tiptopf-AI

Local-first, German, AI-powered recipe library for a Raspberry Pi.

The app stores recipes, collections, the shopping list, and API settings as JSON on disk. Reach it over Tailscale. There is no in-app login and no hosted database.

## Features

- Add recipes from a photo, a URL, or a manual form
- Recipe pages at `/library/[id]` (edit at `/library/[id]/edit`)
- Collections at `/collections`, shopping list at `/einkaufsliste`
- Dark-only German UI (**du**)
- OpenCode for URL/text extraction, Gemini for photos
- JSON backup from `/profile` (API keys stripped unless you opt in)

## Getting started

1. Clone the repository
2. Copy `.env.example` to `.env.local`
3. Set `DATA_DIR` in `.env.local` (example: `./data`)
4. Install dependencies:

```bash
npm install
```

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

Configure OpenCode / Gemini / Pexels keys in **/profile** after startup.

## Required environment variables

- `DATA_DIR` — directory where the local store and images live

## Optional environment variables

- `NEXT_PUBLIC_SITE_URL` — public origin (Tailscale Serve / MagicDNS / reverse proxy). Rebuild after changing it.
- `ACCESS_PIN` — optional shared PIN; empty disables the `/gate` prompt
- `ALLOW_HTTP_FETCH` — set `1` to allow `http://` recipe fetches (https-only by default)

## Local data layout

When `DATA_DIR=./data`:

```text
data/
  tiptopf.json
  tiptopf.json.bak
  recipe-images/
    {recipe-id}.webp
    .trash/
```

Run **one** process per `DATA_DIR`.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Vercel AI SDK
- Local filesystem persistence (JSON + `{id}.webp` files)

## Verification

```bash
npm run build
npm run lint
npm test
npm run e2e
```

Run `npm test && npm run e2e` locally. There is no GitHub Actions workflow for this.

## Deployment

### Docker (recommended)

```bash
cp .env.docker.example .env.docker
docker compose up -d --build
```

Data persists in a Docker named volume.

For bind modes, Tailscale Serve, backup, restore, and corrupt-JSON recovery, see `docs/local-pi-deployment.md` (Option B).

### Manual (Raspberry Pi)

See `docs/local-pi-deployment.md` (Option A).

## Notes

- UI language: German
- API keys and models (OpenCode + Gemini) are configured in `/profile` and stored unencrypted in `tiptopf.json`. Default backups omit keys.
- Default recipe extraction model: `big-pickle` (OpenCode Zen). OpenCode Go is supported via a custom base URL.
- Recipe images from URLs are downloaded and stored locally as `{recipeId}.webp`.
