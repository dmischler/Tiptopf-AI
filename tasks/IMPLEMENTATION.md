# Tiptopf-AI Implementation Plan (v1.0 MVP)

> **Current plan:** [`tasks/POST_REVIEW_HARDENING_PLAN.md`](POST_REVIEW_HARDENING_PLAN.md)  
> Detailed phases: [`tasks/post-review/`](post-review/)  
> Product constraint: pinch-zoom stays disabled (`maximumScale: 1`); readability is fixed with type scale and 44px targets, not by enabling zoom.
>
> This document is the **historical** Supabase MVP phase list. Do not implement from it.
> Local-only Raspberry Pi migration (Option A) is complete: `tasks/completed/LOCAL_PI_OPTION_A_PLAN.md`.

## Quick Start
```bash
# Phase 0: Setup (install missing deps + shadcn)
cd tasks && cat PHASE-0-setup.md

# Then follow phases in order:
# Phase 1: Supabase → Phase 2: Auth → Phase 3: AI → Phase 4: Add Recipe → Phase 5: Library → Phase 6: Interactions
```

## Critical Plan Review (April 17, 2026)

The phased plan is solid for MVP scope and speed, but a few details need practical simplifications:

1. **shadcn registry drift**: `toast`/`form` entries in the original command are no longer always present in `base-nova`; use `sonner` for toasts and add only components the registry resolves.
2. **Phase testing strategy**: `npm run lint` can be interactive on fresh Next.js projects, so `npm run build` is the reliable non-interactive verification command per phase.
3. **Supabase setup reproducibility**: dashboard-only SQL is hard to track; keep the SQL in repo migration files for repeatable setup.
4. **Crypto utility portability**: API key encryption/decryption must run in both browser and server contexts (not browser-only helpers).
5. **Scope discipline**: keep extraction and UI flows simple first (working parse/save/browse), then iterate polish after end-to-end flow is stable.

## File Structure (Generated)
```
src/
├── app/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── profile/page.tsx
│   ├── library/page.tsx
│   ├── actions/
│   │   ├── add-recipe.ts
│   │   ├── extract-recipe.ts
│   │   └── recipe.ts
│   ├── layout.tsx
│   └── page.tsx          → redirects to /library (logged in) or /login
├── components/
│   ├── add-recipe/
│   │   ├── fab.tsx
│   │   ├── modal.tsx
│   │   ├── image-upload.tsx
│   │   ├── url-input.tsx
│   │   ├── preview.tsx
│   │   └── streaming-progress.tsx
│   ├── library/
│   │   ├── masonry-grid.tsx
│   │   ├── recipe-card.tsx
│   │   ├── search-bar.tsx
│   │   ├── sort-dropdown.tsx
│   │   ├── category-filter.tsx
│   │   └── recipe-detail.tsx
│   ├── interactions/
│   │   ├── favorite-button.tsx
│   │   └── rating.tsx
│   ├── profile/
│   │   └── api-key-form.tsx
│   └── theme-provider.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── ai/
│   │   ├── client.ts
│   │   ├── prompts.ts
│   │   ├── extractor.ts
│   │   ├── url-fetcher.ts
│   │   └── image-handler.ts
│   └── crypto.ts
├── types/
│   └── index.ts
└── middleware.ts
```

## Key Decisions Summary
| Decision | Value | Rationale |
|----------|-------|-----------|
| Theme storage | localStorage only | Per VISION.md — device-specific, no DB sync |
| Category input | Fixed dropdown | Matches VISION.md exactly: starter, main, dessert, side, breakfast, snack |
| Masonry layout | Pure CSS columns | No JS dependency, simpler, responsive. Items flow top-to-bottom. |
| API key encryption | Web Crypto API (AES-GCM + PBKDF2) | Browser-native, no external deps. Key derived from user UID. |
| API key storage | `profiles` table columns | `encrypted_api_key` + `api_base_url` in profiles table |
| Email verification | Required on signup | Supabase Auth default |
| Password recovery | Full email-based reset flow | Supabase Auth built-in |
| Auth method | Supabase email + password | Simple, secure, free |
| Auth routes | Flat paths (/login, /signup) | Simpler routing, no route groups |
| URL images | Downloaded to Supabase Storage | Persistent, won't break if source changes |
| Phone images | Discarded after extraction | Per VISION.md — user can upload replacement |
| Manual editing | Minimal — title, category, difficulty, servings before save only | Compromise between VISION.md "out of scope" and usability |
| AI streaming | `streamText` from Vercel AI SDK | Correct API for real-time token streaming |
| AI model | MiniMax-M2.7 via OpenCode Go | Per VISION.md — verify exact model identifier with endpoint |

## Success Criteria (from VISION.md)
- [ ] Add recipe from photo or URL in under 15 seconds
- [x] Masonry grid is beautiful and fun to scroll
- [x] Everything feels fast and polished
- [ ] Zero cost (beyond AI subscription)
