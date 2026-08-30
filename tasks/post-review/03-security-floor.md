# Phase 03 — Security floor (Tailscale-only, no accounts)

**Status:** IMPLEMENTED  
**Depends on:** 01, 02 (02 for UUID image names; 03 image write checks can ship with 02 if needed)  
**Goal:** Keep “no login”. Make LAN/tailnet abuse, SSRF, path traversal, and secret leakage much harder. Do not pretend Tailscale is a small trusted LAN unless ACLs say so.

---

## Threat model (refined)

Anyone who can open TCP to the Next process can today:

- read/write `tiptopf.json` including API keys
- write files under `recipe-images/`
- make the server fetch arbitrary URLs
- spend OpenCode/Gemini/Pexels quota

Phase 03 does **not** add user accounts. It adds:

1. Stop committing leftover env secrets.
2. Bind / firewall / optional pin.
3. SSRF denylist + body cap.
4. UUID + resolved-path image writes.
5. Backups that are not credential dumps.
6. Headers, masked keys in UI, less logging of SDK errors.
7. Docker hardening extras that are cheap.

---

## 1. Git and leftover secrets

### Problem

`.gitignore` has `.env`, `.env.local`, `.env*.local`, `*.env` — **not** `.env.docker`. Git status at review time: `?? .env.docker`. Runtime does **not** read those vars (`DATA_DIR` only). Keys belong in `/profile` → store.

`.dockerignore` already ignores `.env.docker`.

### Work

1. Add to `.gitignore`:

```
.env.docker
```

Keep `.env.docker.example` tracked.

2. If `.env.docker` ever contained real `OPENCODE_API_KEY` / `PEXELS_API_KEY` / Gemini keys: **rotate those keys** at the providers. Do not paste values into git, docs, or chat.
3. Confirm `git check-ignore -v .env.docker` hits `.gitignore`.
4. Never `git add .env.docker`.

Do not start reading API keys from env again. Profile UI remains the source.

---

## 2. Network bind and optional pin

### Docker Compose

Current (`docker-compose.yml:7-8`): `"3000:3000"` publishes on all host interfaces (LAN + Tailscale + public if the Pi has it).

Document **two supported modes** in `docs/local-pi-deployment.md`; default the example to the safer one.

**Mode A — Tailscale Serve (recommended):**

- Compose publish: `"127.0.0.1:3000:3000"`
- `tailscale serve` / HTTPS on the tailnet name
- LAN cannot hit 3000

**Mode B — Tailscale IP / firewall:**

- Keep container `HOSTNAME=0.0.0.0` (required inside the container).
- Host firewall: port 3000 only on `tailscale0`.
- Compose comment warning: do not publish to `0.0.0.0` on a house LAN with guests.

Do not silently switch a running Pi to `127.0.0.1` without documenting Tailscale Serve — that would look like “app is down.”

### Optional `ACCESS_PIN`

Cheap shared secret, not accounts.

- Env: `ACCESS_PIN` (optional). Empty = disabled (current behavior).
- Middleware (`src/middleware.ts`): if pin set, require cookie `tiptopf_pin` matching a server-side compare, or `/gate` form POST.
- Gate page German: “PIN eingeben”.
- Server actions: middleware runs first for the App Router; also check in a small `assertAccess()` used by actions if middleware bypass is a concern.
- Do not store the pin in `tiptopf.json`.
- Constant-time compare (`crypto.timingSafeEqual` on hashed or padded buffers).

This is optional. Implement the middleware so turning it on is one env var. Default off so existing Pi deploys do not lock the owner out.

### Server action origins

`next.config.js` `experimental.serverActions.allowedOrigins`: set from `NEXT_PUBLIC_SITE_URL` host plus localhost. Document MagicDNS / Serve hostname.

---

## 3. Path traversal on image **write**

GET is already safe (`images.ts:35-37` regex). Write is not.

`uploadRecipeImage` (`add-recipe.ts:51-57`) accepts any non-empty string as `recipeId`. `writeRecipeImage` does `path.join(dir, recipeId + '.' + ext)`. `../x` escapes the images dir.

### Work

1. `z.string().uuid()` on `recipeId` in `uploadRecipeImage` (and apply-candidate once it takes a recipe id).
2. After join:

```ts
const filePath = path.resolve(dir, `${recipeId}.${ext}`)
const root = path.resolve(dir) + path.sep
if (!filePath.startsWith(root) && filePath !== path.resolve(dir, `${recipeId}.${ext}`)) throw
```

Safer: because `recipeId` is a UUID, `${recipeId}.webp` cannot contain `..`. UUID parse is sufficient if we never interpolate user strings elsewhere. Still resolve+prefix-check as belt and suspenders.

3. GET already uses `isSafeImageName`. Keep it. Add `X-Content-Type-Options: nosniff` on the image response.

---

## 4. SSRF

### Call sites

| Function | File | Today |
|---|---|---|
| `fetchRecipeUrl` | `url-fetcher.ts:358` | any `http(s)`, 15s timeout, full `response.text()`, follows redirects |
| `downloadImageToLocalStorage` | `images.ts:142` | any URL, buffers all bytes, then 10MB check, no timeout |
| `applyRecipeImageCandidateAction` | `extract-recipe.ts:70` | `z.string().url()` only |
| `extractFromUrlAction` | `extract-recipe.ts:101` | regex `^https?://` |
| OpenCode / Gemini `base_url` | settings | free-form, used as SDK baseURL |

### New `src/lib/http/safe-fetch.ts`

```ts
type SafeFetchOptions = {
  timeoutMs: number
  maxBytes: number
  purpose: 'page' | 'image'
}

safeFetch(url: string, opts): Promise<{ bytes: Uint8Array; contentType: string | null; finalUrl: string }>
```

Rules:

1. Parse URL. Protocol `https:` required by default. Allow `http:` only if `ALLOW_HTTP_FETCH=1` (some recipe blogs still http) — still subject to IP rules.
2. No `file:`, `data:`, `ftp:`, `gopher:`.
3. Resolve hostname (`dns.promises.lookup` both A and AAAA). Reject if **any** result is:
   - loopback (`127.0.0.0/8`, `::1`)
   - RFC1918 (`10/8`, `172.16/12`, `192.168/16`)
   - link-local (`169.254/16`, `fe80::/10`)
   - CGNAT `100.64.0.0/10` **except** we may need Tailscale? **Reject 100.64/10 anyway** — the app should not fetch other tailnet nodes as “recipe URLs”.
   - metadata `169.254.169.254`, `fd00:ec2::254`
   - `0.0.0.0`, IPv4-mapped IPv6 loopback
4. Connect to the resolved address (avoid DNS rebinding): fetch with the hostname in `Host` but prefer `redirect: 'manual'` or `error`, then re-validate each hop (max 3 redirects). If undici/Node fetch cannot pin IP easily, **minimum** is: reject private hostnames before fetch **and** `redirect: 'error'`.
5. Stream read until `maxBytes`, then abort. Pages: 2MB. Images: 10MB (existing). Do not `arrayBuffer()` an unbounded body.
6. Timeout via `AbortSignal.timeout`.
7. Images: after download, sharp metadata must be jpeg/png/webp; do not trust `Content-Type` alone (Phase 02 already re-encodes to webp).

`extractFromUrlAction`: `z.string().url().max(2048)` plus safe-fetch.

Relative og:image / JSON-LD image: `new URL(image, pageUrl)` **after** the page URL is known (Phase 07). Then safe-fetch the absolute URL.

### AI base URLs

Allowlist hostnames:

- Default OpenCode: `opencode.ai` (and current `DEFAULT_BASE_URL` host)
- Default Gemini: `generativelanguage.googleapis.com`

If the user sets a custom base URL, it must still pass the same private-IP denylist (parse + lookup). Reject localhost. Document that custom base URLs are for proxies the owner trusts, still not for `http://192.168.1.1`.

---

## 5. Secrets vs backups vs UI

### Split or strip

**Recommended for this phase (small):** keep settings in `tiptopf.json` for runtime simplicity (keys already there), but:

1. `exportStoreJson({ includeSecrets: false })` default for the Profile “Backup herunterladen” button. Strip `settings.*api_key` to `null`.
2. Separate button or checkbox: “Backup inklusive API-Keys” with a German warning. Default off.
3. Import: if incoming settings keys are null, **do not** overwrite existing keys with null unless the user checks “Keys aus Backup übernehmen”. Default: restore recipes/collections/shopping, keep current keys.

Better split (if time): `DATA_DIR/secrets.json` mode `0600`, store `settings` there. `tiptopf.json` has no keys. Export of recipes never includes them. Phase 11 can encrypt secrets.json.

Implement the strip/keep behavior even if files stay merged — it fixes the “recipe backup is a credential dump” bug.

### Profile UI

- Do not `defaultValue={fullKey}` on password fields.
- Placeholder `••••••••` if a key is set; empty input means “leave unchanged”; a dedicated “Key entfernen” checkbox.
- `updateSettingsAction` must treat empty string as “omit / keep previous”, not “set null”, unless the clear checkbox is set. **This is a behavior change** — today empty fields reset the value (`profile/page.tsx` copy even says so). New copy: “Leer lassen behält den gespeicherten Key. Zum Löschen den Haken setzen.”

### Logs

- Do not `console.error` full SDK `err` objects (they may include `Authorization`). Log `err.name`, HTTP status, sanitized message.
- Do not log raw model output at info in production (`extractor.ts:86-87`).

### File mode

After `writeStore`, `chmod 0600` on `tiptopf.json` (and `secrets.json` if split). Best-effort; ignore on weird FS.

---

## 6. Import as a trust boundary

- Size cap: e.g. 5MB of JSON text (far below 20MB action limit).
- Require `recipes` + `collections` arrays (already). Require `schema_version` once Phase 02 added it; accept missing as v1.
- Run on the write queue (Phase 01).
- Confirm dialog in UI: “Dies ersetzt alle Rezepte. Fortfahren?”
- Do not reset live store on parse failure (Phase 01).

No prototype-pollution work needed (`normalizeStore` rebuilds known fields).

---

## 7. Headers and clickjacking

In `next.config.js` `headers()` for all routes:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(self), microphone=(), geolocation=()
```

CSP: start with a report-only or a strict `default-src 'self'` plus whatever Next 16 + Google Gemini images need. If CSP blocks Next inline scripts, do not ship a broken CSP — headers 1–4 are the must. Document CSP as follow-up if Next’s inline hashes fight us.

Image route: add `nosniff` (see §3).

---

## 8. Docker hardening (cheap)

Production `Dockerfile` already `USER nextjs`. Add in compose:

```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
```

Do **not** `read_only: true` unless `/app/data` and `.next/cache` are writable tmpfs/volumes — easy to break; optional.

Never deploy `Dockerfile.dev` on the Pi (document).

`Dockerfile` currently copies full `node_modules` into runner **and** standalone — out of scope to slim unless it is a one-line obvious fix; mention in backlog.

---

## 9. Other medium items from the review

| Item | This phase? |
|---|---|
| `extractFromImageAction` data-URL mime + size cap | Yes. Reject non jpeg/png/webp; cap decoded size ~5–8MB. |
| Drop `'use server'` from `image-handler.ts` | Phase 07, but if touched here, do it. |
| Rate-limit extract | Optional simple in-memory: 10 extracts / 10 min / process. Nice to have. |
| Gemini `BLOCK_NONE` | Leave. Content-policy choice. |
| Notes HTML | Leave; already escaped. |
| Service worker cache poisoning | SW unused; Phase 06 PWA. Do not register a caching SW in this phase. |

---

## Files to change

| File | Change |
|---|---|
| `.gitignore` | `.env.docker` |
| `docker-compose.yml` | Safer ports comment + optional `127.0.0.1`; cap_drop; no-new-privileges |
| `docs/local-pi-deployment.md` | Bind modes, firewall, ACCESS_PIN, backup-without-keys, rotate leftover env keys |
| `.env.example` / `.env.docker.example` | `ACCESS_PIN=` optional, `ALLOW_HTTP_FETCH=` |
| `next.config.js` | security headers; `allowedOrigins` |
| `src/middleware.ts` | optional pin |
| `src/app/gate/page.tsx` | optional, German PIN form |
| `src/lib/http/safe-fetch.ts` | **Create** |
| `src/lib/ai/url-fetcher.ts` | use safe-fetch |
| `src/lib/local/images.ts` | UUID path check; safe-fetch download; chmod not needed on images |
| `src/app/actions/extract-recipe.ts` | url schema; safe apply |
| `src/app/actions/add-recipe.ts` | UUID recipeId |
| `src/app/actions/settings.ts` | export strip keys; import keep keys; empty field = keep |
| `src/lib/local/store.ts` | `exportStoreJson({ includeSecrets })`; chmod 0600 |
| `src/components/profile/settings-form.tsx` | mask keys |
| `src/components/profile/backup-restore.tsx` | warning + confirm + default no keys |
| `src/lib/ai/extractor.ts` / `image-handler.ts` | sanitize logs |
| `src/app/api/images/[imageName]/route.ts` | nosniff |

---

## Implementation steps

1. `.gitignore` + docs note to rotate keys. Do this first, even if the rest of the phase waits.
2. UUID + resolve check on image write (can land with Phase 02).
3. `safe-fetch` + wire url-fetcher + image download.
4. Export strip keys + settings empty-keep + masked inputs.
5. Headers.
6. Compose comments + cap_drop.
7. Optional ACCESS_PIN middleware (default off).
8. Manual: from another device on LAN, confirm expected bind behavior; confirm `http://127.0.0.1:3000` still works on the Pi.

---

## Acceptance

- `git add -A` does not stage `.env.docker`.
- `uploadRecipeImage` with `recipeId=../passwd` fails validation.
- `extractFromUrlAction('http://127.0.0.1:3000/library')` throws a German “URL nicht erlaubt”.
- Profile backup default JSON has `"opencode_api_key": null` (or omits keys) even when keys exist on disk.
- Saving settings with empty key fields does not wipe stored keys.
- `maximumScale: 1` unchanged (not this phase, but do not “fix a11y” by removing it).
- Production container still runs as `nextjs`.

## Out of scope

- Full CSP if it breaks Next
- Encrypted-at-rest keys (Phase 11)
- User accounts / magic links
- Enabling zoom
