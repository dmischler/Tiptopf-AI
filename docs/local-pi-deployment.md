# Local Deployment Guide

Two deployment options are available:

- **Option A:** Direct Node.js on Raspberry Pi
- **Option B:** Docker container (any machine with Docker)

---

## Option A: Direct Node.js

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
```

Notes:
- `DATA_DIR` may be absolute or project-relative.
- Use a persistent filesystem path for production.
- API keys and model/base URL configuration are set inside the app at `/profile`.
- Optional `ACCESS_PIN=` (empty = disabled). When set, the app shows `/gate` (“PIN eingeben”).
- Optional `ALLOW_HTTP_FETCH=1` allows `http://` recipe URLs. Private, loopback, link-local, and CGNAT (`100.64.0.0/10`) destinations are always blocked.
- If an old `.env.docker` ever contained real `OPENCODE_API_KEY` / `PEXELS_API_KEY` / Gemini keys, rotate those keys at the providers. The app does not read API keys from env.

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

The Node process still binds `0.0.0.0` inside the app. How you expose port 3000 on the host is a separate choice (see **Network bind modes** below).

## 4) Access over Tailscale

Use one of:
- `http://<tailscale-ip>:3000` (only if the host publishes 3000 on the tailnet interface)
- `http://<tailscale-magicdns-name>:3000`
- `https://<magicdns-or-serve-hostname>` when using Tailscale Serve

If using a reverse proxy/Tailscale Serve for HTTPS, point it to `127.0.0.1:3000` (Mode A).

Set `NEXT_PUBLIC_SITE_URL` to that public origin (including `https://` and the MagicDNS / Serve hostname) so server actions accept it. Rebuild after changing it.

## Runtime storage layout

With `DATA_DIR=/home/pi/tiptopf-data`:

```text
/home/pi/tiptopf-data/
  tiptopf.json
  tiptopf.json.bak
  tiptopf.json.corrupt.<iso>
  recipe-images/
    {recipeId}.webp
    .trash/
      {recipeId}.webp
```

Leftover `tiptopf.json.tmp.<uuid>` or `recipe-images/<name>.tmp.<uuid>` files can appear after a crash. They are ignored on boot and are safe to delete.

**One process only:** run a single Tiptopf-AI process per `DATA_DIR`. The in-process write queue does not coordinate across processes. Two Node processes (or two containers) on the same data directory can still interleave writes.

## Data model

`tiptopf.json` contains:
- `schema_version` (current: `2`; missing is treated as `1`)
- `recipes[]` matching the existing `Recipe` shape
- `profile` with:
  - `id` (`local-device`)
  - `email` (`local@tiptopf.local`)
- `settings` with API keys and model/base URL configuration for OpenCode, Gemini (unified `gemini_*` fields since 2026-05), and Pexels. Old `gemini_image_*` fields are auto-migrated on load.

## AI Model Configuration (OpenCode)

Tiptopf-AI uses **OpenCode Zen** (an OpenAI-compatible gateway at `opencode.ai`) for recipe extraction from text and URLs. Image extraction uses Gemini (configured separately).

### Default Configuration

- **Default model**: `big-pickle`
- **Default base URL**: `https://opencode.ai/zen/v1`

**Big Pickle** is a free (beta/limited) model on OpenCode Zen, widely understood to be Zhipu AI's GLM-4.6. It offers strong reasoning and excellent structured/JSON output — well suited to recipe extraction.

**Known limitation**: Community reports indicate that GLM-4.6 can produce slightly less natural German than previous GLM versions or certain other models (occasional grammar issues or unnatural phrasing). Because the app requires all recipe output (title, ingredients, instructions, tags) to be in German, test extraction quality after changing models.

### Where to Configure

Go to **/profile** in the app. The relevant section is "OpenCode":

- **OpenCode API-Key**: Your Zen API key (create at [opencode.ai](https://opencode.ai))
- **OpenCode Base URL**: Leave empty for the default free Zen endpoint, or enter a custom one
- **OpenCode Modell-ID**: Leave empty to use `big-pickle`, or enter any supported model ID

Empty fields always fall back to the built-in defaults.

### Using the OpenCode Go Subscription

The free Zen tier has rate limits. For more generous usage and stronger models, subscribe to the **OpenCode Go** plan ($5 first month, then $10/month):

1. Subscribe at [https://opencode.ai/go](https://opencode.ai/go) (uses the same Zen account).
2. In **/profile**, set:
   - **OpenCode Base URL**: `https://opencode.ai/zen/go/v1`
   - **OpenCode Modell-ID**: One of the Go models (current strong options include):
     - `qwen3.7-max` or `qwen3.6-plus` — generally best multilingual/German + structured output
     - `kimi-k2.6` or `kimi-k2.5` — excellent reasoning and instruction following
     - `glm-5.1` — very strong agentic/structured model (test German quality)
     - `minimax-m2.7` — paid successor to the older minimax models
3. Your existing Zen API key works for Go as well.

You can list currently available Go models with:
```bash
curl https://opencode.ai/zen/go/v1/models \
  -H "Authorization: Bearer YOUR_ZEN_API_KEY"
```

To switch back to the free tier, simply clear the Base URL field (or set it to `https://opencode.ai/zen/v1`) and use `big-pickle` (or another free model such as `mimo-v2-pro-free`).

### Tips for Model Selection

- Start with the default (`big-pickle`). It is fast and capable for most users.
- If German output quality feels off, try a Go subscription model (especially Qwen variants) or stick with Gemini for images.
- The extraction code is resilient: it cleans markdown code fences and validates output with Zod. Minor formatting issues are often auto-corrected.
- Gemini (configured in the separate "Gemini" section on /profile) is used for photo-based recipe extraction and has its own model/fallback settings.

## Image handling

- Contract: `recipe.image_url` is `/api/images/{recipeId}.webp` or `null`
- File on disk: `DATA_DIR/recipe-images/{recipeId}.webp`
- Uploaded replacement images are validated (JPG/PNG/WEBP, up to 5 MB)
- Remote/Pexels URLs stay as candidates until the recipe is saved; bytes are written only when `recipe.id` is known
- Images are served by `GET /api/images/[imageName]` (query string is ignored)
- Clients may append `?v={updated_at}` to bust caches after an in-place replace
- Existing `{recipeId}.*` variants are deleted after a durable write of `{recipeId}.webp`
- On first boot of schema 1 stores, leftover random UUID files (`/api/images/{other}.jpg` etc.) are renamed or re-encoded to `{recipeId}.webp`
- Deleted recipes: the image is renamed to `recipe-images/.trash/{recipeId}.webp`. Undo within ~30s moves it back. After the undo window or the next process boot, `.trash/` is emptied
- `GET /api/images/` never serves `.trash/` (names with `/` are rejected)

## Backup and restore

Backup:

```bash
tar -czf tiptopf-backup.tar.gz -C /home/pi tiptopf-data
```

Restore:

```bash
tar -xzf tiptopf-backup.tar.gz -C /home/pi
```

You can also download a JSON backup from **Profil → Daten-Backup** and restore it there.

The default UI backup strips API keys (`opencode_api_key`, `gemini_api_key`, `pexels_api_key` are `null`). Enable “Backup inklusive API-Keys” only when you need credentials in the file. On restore, keys from the backup are ignored unless you check “Keys aus Backup übernehmen”. Importing replaces all recipes (confirm dialog). Max JSON size is 5 MB.

### Corrupt `tiptopf.json`

A truncated, empty, or invalid library file is **not** replaced with an empty default store. The app fails closed and shows: *Die Bibliothek-Datei ist beschädigt…*

On detect:

- The bad file is renamed (or copied if rename fails) to `tiptopf.json.corrupt.<iso-timestamp>`.
- The previous successful write is kept as a single rolling `tiptopf.json.bak` (written before each durable replace).
- No new empty `tiptopf.json` is created automatically. If the live file is missing but `.bak` or `.corrupt.*` files exist, the app still refuses to first-boot empty.

Restore (stop the app first):

```bash
# Prefer last-good snapshot
cp /home/pi/tiptopf-data/tiptopf.json.bak /home/pi/tiptopf-data/tiptopf.json

# Or inspect a quarantined copy, then copy back if it is actually valid
ls -lt /home/pi/tiptopf-data/tiptopf.json.corrupt.*
```

Then start the app and confirm `/library` loads. If the JSON is still unreadable, restore from a Profil backup or the `tar` archive instead.

Writes use temp file → fsync → rename → directory fsync, so a power loss should leave either the old or the new complete JSON, not a 0-byte live file.

## Network bind modes

Two supported ways to reach the app. The process inside still listens on `0.0.0.0:3000`.

### Mode A — Tailscale Serve (recommended)

Publish only on loopback, then Serve on the tailnet:

```bash
# Direct Node (systemd/npm): still bind 0.0.0.0 in the process, then firewall
# 3000 to localhost, OR bind the HTTP server to 127.0.0.1 if you terminate via Serve.

sudo tailscale serve --bg 3000
```

Docker Compose defaults to this publish:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

Effects:
- LAN guests cannot hit port 3000.
- Other tailnet devices use `https://<machine>.<tailnet>.ts.net` (Serve), not `http://<tailscale-ip>:3000`.
- **Do not switch a running Pi to `127.0.0.1` without Serve.** From the rest of the tailnet it looks like the app is down.

Set `NEXT_PUBLIC_SITE_URL=https://<machine>.<tailnet>.ts.net` before `docker compose up -d --build`.

### Mode B — Tailscale IP / host firewall

Keep publishing on all host interfaces and restrict with the firewall:

```yaml
ports:
  - "3000:3000"
```

Then allow TCP 3000 only on `tailscale0`, not on `eth0`/`wlan0`:

```bash
sudo nft insert rule inet filter input iifname "tailscale0" tcp dport 3000 accept
sudo nft insert rule inet filter input tcp dport 3000 drop
```

(Adjust to your nftables/ufw layout.) Do **not** publish `0.0.0.0:3000` on a house LAN with guests unless the firewall is in place.

## Security notes

- App does not enforce user accounts. Anyone who can complete TCP to the process is the owner.
- Restrict access using Tailscale ACLs/users/devices, bind mode A or B, and optional `ACCESS_PIN`.
- `ACCESS_PIN` is env-only (not stored in `tiptopf.json`). Empty = off. Cookie name: `tiptopf_pin`.
- API keys are stored in `DATA_DIR/tiptopf.json` (currently unencrypted). The file is chmod `0600` after writes when the filesystem allows it.
- Recipe backups from Profil do not include API keys unless you opt in.
- Outbound URL/image fetch denies private, loopback, link-local, metadata, and CGNAT addresses.
- Custom OpenCode/Gemini base URLs must not be localhost or private IPs. Defaults (`opencode.ai`, `generativelanguage.googleapis.com`) are allowlisted.
- Restrict file access on host and keep `DATA_DIR` private.
- Do not deploy `Dockerfile.dev` on the Pi. Production uses `Dockerfile` (`USER nextjs`).
- CSP is not shipped (Next inline scripts). Clickjacking/nosniff/referrer/permissions headers are set.

## Troubleshooting

### App starts but no data is saved
- Confirm `DATA_DIR` is set and writable by the app process.

### UI says the library file is damaged
- Do not delete `tiptopf.json.bak` or `tiptopf.json.corrupt.*` first.
- Restore from `.bak` (see **Corrupt `tiptopf.json`**).
- Confirm only one app process is using `DATA_DIR`.

### Images do not load
- Confirm files exist in `DATA_DIR/recipe-images`.
- Verify route: `/api/images/<file-name>` returns 200.

### Cannot reach from another device
- Mode A: confirm `tailscale serve` is active and you are using the Serve/MagicDNS HTTPS URL, not LAN `:3000`.
- Mode B: ensure the host firewall allows 3000 on `tailscale0` and the compose ports mapping is `"3000:3000"`.
- Check Tailscale status on both devices.

### View logs (direct install)

When running via the systemd service (recommended for production, see `docs/SETUP.md`):
```bash
sudo journalctl -u tiptopf -f
```

When running `npm run start` directly in the foreground, logs print to the terminal.

## Verify after deployment

1. Open `/library`
2. Add a recipe from URL
3. Replace recipe image
4. Restart app process and confirm data persists

---

## Option B: Docker

This guide documents how to run Tiptopf-AI as a Docker container on any machine (including a Raspberry Pi).

### Overview

- No Supabase dependency
- No in-app login/signup
- Single local profile persisted in a Docker named volume
- Recipes and images stored in `DATA_DIR` inside the container, backed by a named volume
- Access control handled by Tailscale network identity

### Prerequisites

- Docker Engine 20+ and Docker Compose v2
- Tailscale installed and authenticated on the host

### 1) Configure environment

```bash
cp .env.docker.example .env.docker
```

No API keys are required in `.env.docker`; configure them (including OpenCode model settings) in `/profile` after startup.
See the "AI Model Configuration (OpenCode)" section above for details on Big Pickle and the OpenCode Go subscription.

Optional in `.env.docker`:
- `ACCESS_PIN=` — shared PIN; empty disables `/gate`
- `ALLOW_HTTP_FETCH=` — set `1` to allow `http://` recipe fetches
- `NEXT_PUBLIC_SITE_URL=` — public origin (Serve/MagicDNS hostname). Needed so server actions allow that host.

If an older `.env.docker` contained provider API keys, rotate those keys. They are unused at runtime.

Compose injects `.env.docker` into the container. For **build-arg** substitution (`NEXT_PUBLIC_SITE_URL` → `allowedOrigins`), run:

```bash
docker compose --env-file .env.docker up -d --build
```

### 2) Build and start

```bash
docker compose --env-file .env.docker up -d --build
```

Default publish is **Mode A**: `127.0.0.1:3000:3000` plus `cap_drop: ALL` and `no-new-privileges`. The container process still uses `HOSTNAME=0.0.0.0` and `USER nextjs`.

On the Pi, enable Serve so the tailnet can reach the app:

```bash
sudo tailscale serve --bg 3000
```

To keep the old “port 3000 on all interfaces” behavior, use **Mode B** in `docker-compose.yml` (commented `3000:3000`) and firewall 3000 to `tailscale0`. Switching to `127.0.0.1` without Serve will make the app unreachable from other devices.

### 3) Access the app

- On the Pi: `http://127.0.0.1:3000`
- Mode A + Serve: `https://<machine>.<tailnet>.ts.net`
- Mode B: `http://<tailscale-ip>:3000` (not from the house LAN unless you opened it)

### Runtime storage layout

Data lives in a Docker named volume:

```text
tiptopf-data/ (named volume, managed by Docker)
  └── data/
      ├── tiptopf.json
      ├── tiptopf.json.bak
      ├── tiptopf.json.corrupt.<iso>
      └── recipe-images/
          ├── {recipeId}.webp
          └── .trash/
              └── {recipeId}.webp
```

Run **one** container (one process) against this volume. Do not mount the same `DATA_DIR` into a second app instance.

### Backup and restore

Backup:

```bash
docker compose exec app tar -czf /tmp/backup.tar.gz -C /app/data . && \
  docker compose cp app:/tmp/backup.tar.gz ./tiptopf-backup.tar.gz
```

Restore:

```bash
docker compose cp ./tiptopf-backup.tar.gz app:/tmp/backup.tar.gz && \
  docker compose exec app tar -xzf /tmp/backup.tar.gz -C /app/data && \
  docker compose exec app rm /tmp/backup.tar.gz
```

If the UI reports a damaged library, restore the last-good file inside the volume (stop or exec while the app is idle):

```bash
docker compose exec app cp /app/data/tiptopf.json.bak /app/data/tiptopf.json
```

A truncated `tiptopf.json` is quarantined as `tiptopf.json.corrupt.<iso>` and is never auto-replaced with an empty store. See **Corrupt `tiptopf.json`** above.

### Update

```bash
git pull
docker compose up -d --build
```

### Viewing Logs

```bash
# Follow logs live (most common)
docker compose logs -f

# View the last 100 lines
docker compose logs --tail 100

# Follow with timestamps
docker compose logs -f -t

# View logs for the app service only
docker compose logs -f app
```

Logs show application output (including AI extraction, errors, and startup messages). Use this as the first step when recipes fail to save or images don't load.

### Troubleshooting

- Check container status and health: `docker compose ps`
- Restart the app after config or code changes: `docker compose restart`
- View a large recent window after a problem: `docker compose logs --tail 200 --no-color`
- The container includes a healthcheck hitting `/library` (defined in `docker-compose.yml`).

Common issues:
- App won't start → inspect logs for port conflicts or `DATA_DIR` problems.
- AI features (extraction, image generation) broken → keys are configured inside the app at `/profile` (not in `.env.docker`).
- Images not loading → confirm the volume mounted correctly and files exist in the persisted data.

### Security notes

- App runs as non-root user `nextjs` inside the container (`Dockerfile` `USER nextjs`)
- Compose drops all capabilities and sets `no-new-privileges`
- Do not deploy `Dockerfile.dev` on the Pi
- API keys are configured and stored via `/profile` in persisted app data
- Restrict access using Tailscale ACLs, bind Mode A or B, and optional `ACCESS_PIN`
- Do not expose port 3000 on the public internet or an untrusted house LAN
