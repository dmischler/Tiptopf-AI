# VISION.md

**Project Name:** Tiptopf-AI  
**Tagline:** A dark, German, AI-powered household recipe library that lives on your Raspberry Pi.

**Runtime:** Single-user local / Raspberry Pi · JSON on disk · Tailscale as the network ACL  
**UI language:** German (**du**)  
**Status:** Live local-Pi app. Current work: `tasks/POST_REVIEW_HARDENING_PLAN.md`

## 1. Vision

Tiptopf-AI turns a phone photo, a recipe URL, or a typed draft into a structured German recipe card. The household browses, cooks, and shops from one library.

It is **not** a multi-user SaaS. There is no in-app login. Whoever can reach the process (Tailscale / host firewall, optional `ACCESS_PIN`) is the owner. Recipes, collections, shopping list, and API settings live in `DATA_DIR/tiptopf.json`. Images live at `DATA_DIR/recipe-images/{recipeId}.webp`.

**Core promise:** AI does the typing. The household owns the files. Nothing depends on a hosted database.

**Target users:** Home cooks and families sharing one Pi.

## 2. Goals

- Run on a Raspberry Pi (or any Docker host), reached over Tailscale
- German UI, dark amber theme only
- Add from camera, URL, or a manual form
- A recipe is a **page** (`/library/[id]`), not an overlay
- Library as a CSS grid of cards (not masonry-css)
- Search, filter, sort, favorites, ratings, tags, notes, collections, shopping list
- API keys on `/profile` (unencrypted at rest; default JSON backup strips them)

## 3. Product surface

### Add recipe

- Expandable FAB: Zufallsrezept, Manuell, URL, Bild
- URL extract always goes through OpenCode so the stored recipe is German and metric
- Image extract uses Gemini
- Saved hero image is local `{recipeId}.webp` after save
- Preview / edit, then save

### Library

- `/library` — CSS grid of cards
- `/library/[id]` — cook-readable recipe page (print works; hardware back closes it)
- `/library/[id]/edit` — same fields as add
- Search, category, difficulty, favorites, time filter, sort

### Collections & shopping

- `/collections`, `/collections/[id]`
- `/einkaufsliste`

### Profile

- Title, API/model settings (OpenCode, Gemini, Pexels), backup/restore
- No dummy email or user id

## 4. Out of scope (this round)

- Multi-user accounts / per-user libraries
- SQLite (JSON stays the store until the backlog)
- Encrypted keys at rest
- Light theme
- True masonry layout
- Meal planner, nutrition, public sharing

See `tasks/post-review/11-backlog.md`.

## 5. User flows

1. Open the Pi over Tailscale → `/library` (optional PIN at `/gate`)
2. `/profile` → paste OpenCode (and Gemini) keys once
3. Add a recipe from photo or URL → review the German card → save
4. Open `/library/[id]` to cook; scale portions; send ingredients to the shopping list
5. Backup JSON from Profil (keys stripped unless you opt in)

## 6. Architecture

```text
Next.js App Router (Node on the Pi)
  → Server Actions
  → AI layer (OpenCode Zen / Go for text + URL; Gemini for images)
  → Local JSON store + {id}.webp files in DATA_DIR
  → Tailscale (Serve or host firewall) as ACL
```

**Key decisions:**

- Next.js + TypeScript + Tailwind + shadcn/ui
- One process per `DATA_DIR`
- Durable writes (temp → fsync → rename); corrupt JSON fails closed
- No in-app auth; optional `ACCESS_PIN`
- Default extract model: `big-pickle` on OpenCode Zen

## 7. Tech stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js App Router + TypeScript | One process, server actions |
| Styling | Tailwind + shadcn/ui, dark only | Warm amber kitchen UI |
| Persistence | `DATA_DIR/tiptopf.json` + recipe-images | No hosted database |
| AI | Vercel AI SDK, OpenCode + Gemini | User-supplied keys in `/profile` |
| Library layout | CSS grid | Simple until a true masonry pass |
| Access | Tailscale + optional PIN | Household ACL |
| Deploy | Node on the Pi or Docker | `docs/local-pi-deployment.md` |

## 8. Data model (`tiptopf.json`)

`schema_version`: **3** (missing is treated as 1; 2 was image identity `{id}.webp`; 3 drops leftover `user_id` / dummy profile).

**recipes[]**

- `id` (uuid)
- `title`, `ingredients[]`, `instructions`
- `prep_time`, `cook_time`, `servings`
- `category`, `difficulty`
- `rating`, `is_favorite`
- `image_url` (`/api/images/{id}.webp` or `null`)
- `source_url`, `source_type` (`image` \| `url` \| `manual`)
- `tags[]`, `notes`
- `created_at`, `updated_at`

No `user_id`. Older files may still contain it; load ignores it, writes omit it.

Also: `collections[]`, `shoppingList[]` (camelCase: `addedAt`, `sourceRecipeTitle`, `sourceServings`), `settings` (OpenCode / Gemini / Pexels). Default export sets API keys to `null`.

Older backups may include `profile` (`local-device` / `local@tiptopf.local`); import ignores it.

## 9. AI

- OpenCode: URL and text extraction. JSON-LD is model **input**, not the stored recipe
- Gemini: photo extraction
- Stored output: German, metric
- Keys live in settings, not environment variables

## 10. Design & UX

- Dark only, warm amber accents
- German UI, address the user as **du**
- CSS grid library (not masonry-css)
- Recipe **pages**, not a full-screen overlay
- Categories: starter, main, dessert, side, breakfast, snack
- Difficulty labels: Einfach / Mittel / Schwer
- Mobile-first kitchen use; pinch-zoom stays disabled (`maximumScale: 1`)

## 11. Security

- No user accounts. Completing TCP to the process means owner
- Restrict with Tailscale ACLs, bind mode, and optional `ACCESS_PIN`
- Keys sit unencrypted in `tiptopf.json` (`chmod 0600` when the filesystem allows)
- Recipe backups strip keys unless you opt in
- Outbound URL/image fetch denies private, loopback, link-local, and CGNAT hosts
- Custom OpenCode/Gemini base URLs must not be localhost or private IPs

## 12. Deployment

- Hosting: Raspberry Pi or Docker on the LAN / tailnet
- AI cost: the household’s OpenCode / Gemini usage
- Ops: `docs/local-pi-deployment.md`

## 13. Implementation

Current plan: `tasks/POST_REVIEW_HARDENING_PLAN.md`  
Historical: `tasks/IMPLEMENTATION.md`, `tasks/completed/LOCAL_PI_OPTION_A_PLAN.md`

## 14. Success criteria

- A photo or URL becomes a German recipe without manual typing
- The library is pleasant to scroll on phone and desktop
- Power loss cannot silently empty the library
- Hardware back leaves a recipe page
- Household data stays on the Pi
