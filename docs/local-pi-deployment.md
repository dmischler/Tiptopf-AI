# Local Raspberry Pi Deployment (Option A)

This guide documents how to run Tiptopf-AI as a local-only service on a Raspberry Pi, with remote access via Tailscale.

## Overview

- No Supabase dependency
- No in-app login/signup
- Single local profile persisted on disk
- Recipes and images stored in `DATA_DIR`
- Access control handled by Tailscale network identity

## Prerequisites

- Raspberry Pi (recommended: Pi 4/5)
- Node.js 20+ and npm
- Tailscale installed and authenticated on the Pi

## 1) Configure environment

Create `.env.local`:

```bash
cp .env.example .env.local
```

Set values:

```env
DATA_DIR=/home/pi/tiptopf-data
OPENCODE_API_KEY=your_opencode_api_key
# Optional
# OPENCODE_BASE_URL=https://opencode.ai/zen/v1
# OPENCODE_MODEL_ID=minimax-m2.5
```

Notes:
- `DATA_DIR` may be absolute or project-relative.
- Use a persistent filesystem path for production.

## 2) Install and build

```bash
npm install
npm run build
```

## 3) Run the app

Development:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Production:

```bash
npm run start -- --hostname 0.0.0.0 --port 3000
```

The `0.0.0.0` bind is required so the app is reachable over Tailscale.

## 4) Access over Tailscale

Use one of:
- `http://<tailscale-ip>:3000`
- `http://<tailscale-magicdns-name>:3000`

If using a reverse proxy/Tailscale Serve for HTTPS, point it to local port `3000`.

## Runtime storage layout

With `DATA_DIR=/home/pi/tiptopf-data`:

```text
/home/pi/tiptopf-data/
  tiptopf.json
  recipe-images/
    <recipe-id>.jpg
    <recipe-id>.png
    <recipe-id>.webp
```

## Data model

`tiptopf.json` contains:
- `recipes[]` matching the existing `Recipe` shape
- `profile` with:
  - `id` (`local-device`)
  - `email` (`local@tiptopf.local`)

## Image handling

- Uploaded replacement images are validated (JPG/PNG/WEBP, up to 5 MB)
- URL images are downloaded and persisted locally
- Images are served by `GET /api/images/[imageName]`
- Existing image variants for a recipe are replaced when writing a new one

## Backup and restore

Backup:

```bash
tar -czf tiptopf-backup.tar.gz -C /home/pi tiptopf-data
```

Restore:

```bash
tar -xzf tiptopf-backup.tar.gz -C /home/pi
```

## Security notes

- App does not enforce login in Option A.
- Restrict access using Tailscale ACLs/users/devices.
- API key is set via `OPENCODE_API_KEY` in `.env.local`.
- Keep `.env.local` private and out of git.

## Troubleshooting

### App starts but no data is saved
- Confirm `DATA_DIR` is set and writable by the app process.

### Images do not load
- Confirm files exist in `DATA_DIR/recipe-images`.
- Verify route: `/api/images/<file-name>` returns 200.

### Cannot reach from another device
- Ensure app is bound to `0.0.0.0`.
- Check Tailscale status on both devices.
- Verify firewall allows chosen port.

## Verify after deployment

1. Open `/library`
2. Add a recipe from URL
3. Replace recipe image
4. Restart app process and confirm data persists
