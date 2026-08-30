# Phase 11 — Backlog (explicitly not this round)

**Status:** PARKED  
**Depends on:** 01–10 done  
**Goal:** Capture review ideas that are real improvements but would dilute the hardening sequence. Do not pull these into Phases 01–10 without an explicit owner decision.

---

## 1. SQLite

When JSON rewriting the whole library on every shopping toggle, or wanting real FKs, move to `node:sqlite` / `better-sqlite3` on the Pi.

Target sketch (from the review):

- `recipes`, `recipe_ingredients` (keep `raw_text`), `recipe_steps`, `recipe_tags`
- `collections` + `collection_recipes` with `ON DELETE CASCADE`
- `shopping_list_items` with `source_recipe_id ON DELETE SET NULL`
- `schema_migrations`
- Secrets **not** in this DB (`DATA_DIR/secrets.json`)
- Images stay files `{id}.webp`

Do **not** go back to Postgres/Supabase for this product.

---

## 2. Encrypted keys at rest

After secrets live in `secrets.json`:

- Optional user PIN derives a key (PBKDF2 / Argon2) and encrypts that file (AES-GCM)
- Conflicts with “no login” — PIN is now required at boot
- Only do this if the Pi disk is not considered trusted (guest users on the OS)

Phase 03 already strips keys from recipe backups and masks UI.

---

## 3. Light mode

VISION toggle + localStorage. Requires replacing raw `zinc-800` / `cyan-300` chips with theme tokens. Do not add a toggle while chips are hard-coded dark colors.

---

## 4. True Pinterest masonry

CSS grid from Phase 06 is row-major equal-aspect cards. Real masonry (`grid-template-rows: masonry` where supported, or a small JS measurer) + intrinsic image heights. Only after images are reliably `{id}.webp` and the library is a grid.

---

## 5. Cook mode

- Wake lock (`navigator.wakeLock`)
- Step check-off (local, not necessarily persisted)
- Bigger type (Phase 06 already raises the floor; cook mode can go larger)
- Landscape step pager
- Timer from step text (later)

Still **no pinch-zoom**. Cook mode is how we make zoom unnecessary for long recipes.

---

## 6. Structured ingredients

Parse amount/unit/name at save time; keep `raw_text`. Shopping list merges `name+unit`. Scaling becomes trivial. Depends on a stable parser (Phase 08/10).

---

## 7. Offline PWA

Real service worker: precache shell, cache `/api/images` with care (image replace cache-bust from Phase 02). Register only after it does something. Offline extract will still fail (needs AI).

---

## 8. Desktop parallel route overlay

`/library/[id]` as a `@modal` intercept on desktop so the grid stays underneath. Mobile stays a full page. Not required; pages already fix back/print.

---

## 9. ACCESS_PIN default-on, Tailscale Serve only

Phase 03 ships pin **off** and documents bind modes. A later hardening can default pin on for LAN-exposed deploys.

---

## 10. AI image generation

The picker toast lied. If we ever add it: a real button that calls a dedicated model, separate from extract. Do not resurrect the toast until the feature exists.

---

## 11. i18n framework

Not needed for a German-only app. `recipe-meta.ts` + inline German is the system.

---

## 12. `flock` / multi-process store

One Node process per `DATA_DIR` is the rule. If we ever run multiple workers, add a file lock or SQLite.

---

## 13. Dockerfile slim

Standalone already includes the server; copying full `node_modules` into the runner is redundant/bloat. Slim when touching Docker anyway.

---

## 14. Rate limits / quotas UI

Show remaining-friendly errors for 429 from Gemini/OpenCode. In-memory extract rate limit was optional in Phase 03.

---

## Do not quietly start these during 01–10

If a phase ticket seems to “need” SQLite, light mode, or zoom, it does not. Re-read Phase 00.
