# VISION.md

**Project Name:** Tiptopf-AI  
**Tagline:** Your beautiful, AI-powered Pinterest-style recipe library — upload a photo or URL and watch it transform into a searchable, sortable, dark-mode collection of recipes.

**Version:** 1.0 (MVP)  
**Date:** April 17, 2026  
**Author:** Dominic Mischler (with Grok collaboration)  
**Status:** Ready to build

## 1. Vision & Project Overview

Tiptopf-AI is a modern, multi-user web application that lets anyone instantly turn a phone photo of a recipe or a recipe website URL into a beautifully formatted recipe card.  

The entire library lives in a **dark-mode Pinterest-style masonry grid** — visually stunning, fast, and delightful to browse. Users can search, filter by category (starter, main, dessert, etc.), sort, mark favorites, and rate recipes.  

**Core promise:**  
Zero manual data entry. AI does the heavy lifting. You keep full ownership of your data. Everything stays private per user.

**Target users:**  
- Home cooks who collect recipes from magazines, family notes, or websites  
- Families or small groups who want to share a common library  
- Anyone tired of scattered screenshots and bookmarks

## 2. Core Goals (MVP)

- Deliver a **production-ready, beautiful app** in 2–3 weekends of development time  
- Support **image upload** (phone camera) **or** **URL paste** as the only two input methods  
- Fully automatic AI parsing using **your OpenCode Go subscription (MiniMax M2.7)**  
- Store everything in a free-tier Supabase database (zero hosting cost beyond your existing AI subscription)  
- Deploy instantly on **Vercel**  
- Provide a delightful dark Pinterest UX with masonry cards  
- Support multi-user authentication (email + password) with per-user private libraries  
- Keep the codebase clean, extensible, and beginner-friendly even for someone comfortable with Python

## 3. MVP Features (Exactly What We Will Build)

### Authentication & Profiles
- Email + password login via Supabase Auth  
- Protected routes (only logged-in users see their library)  
- Profile settings page where user can add their OpenCode Go API key (and base URL) once — stored encrypted

### Add Recipe Flow
- Floating "+" button → modal with two tabs:
  1. **Upload Image** (from phone/camera)  
  2. **Paste URL** (recipe website)
- AI automatically extracts:
  - Title
  - Ingredients (as clean list)
  - Instructions / steps
  - Prep time + Cook time
  - Servings
  - Category (starter, main, dessert, side, breakfast, snack, etc.)
  - Difficulty level (easy, medium, hard)
- Progress bar with streaming updates from the AI
- **Image handling rules** (exactly as requested):
  - Phone image: **temporary only** (used for OCR/text extraction, then discarded — never stored long-term)
  - URL recipes: automatically extract the main recipe photo if present
  - Fallback options: user can upload a replacement image **or** click "Generate Image" button (placeholder for now; future image-gen integration)
- One-click "Save to Library"

### Library / Feed
- Dark-mode Pinterest masonry grid (responsive, beautiful cards)
- Each card shows:
  - Hero image
  - Title
  - Category badge
  - Prep + Cook time
  - Difficulty badge
  - Average rating (1–5 stars)
  - Favorite heart icon
- Search bar (title + ingredients)
- Filters: Category, Favorites only
- Sorting: Newest, Oldest, Prep time (shortest first), Rating (highest first)
- Click card → full-screen recipe view (clean, printable layout)

### Interactions
- Mark as favorite (heart)
- Rate recipe (1–5 stars)
- All data is private per user

## 4. Explicitly Out of Scope for MVP (v2)

- Manual editing of AI-parsed recipes  
- Meal planner / calendar  
- Nutrition information  
- Cuisine tags / custom tags  
- Personal notes / comments  
- Sharing recipes publicly or with specific users  
- Advanced image generation (will be added as a nice button that calls a separate model)

## 5. User Flows (High-Level)

1. **New user** → Sign up → Profile → Add OpenCode Go key → Start adding recipes  
2. **Add recipe** → Upload or paste → Watch AI parse → Review summary → Save  
3. **Browse library** → Scroll beautiful masonry → Filter/Search → Favorite/Rate  
4. **View recipe** → Full details with clean typography and print button

## 6. Technical Architecture
Frontend (Next.js 15 App Router)
↓ (Server Actions / API Routes)
AI Service Layer (Vercel AI SDK + OpenCode Go / MiniMax M2.7)
↓
Supabase (PostgreSQL + Auth + Storage)
↓
Vercel Hosting (Edge + Serverless)

**Key design decisions:**
- Next.js 15 + TypeScript + Tailwind + shadcn/ui → fastest path to beautiful UI
- Supabase for auth + DB + storage → completely free, excellent DX, row-level security
- Vercel AI SDK → clean streaming + tool-calling support for MiniMax endpoint
- No backend server to maintain

**Why Next.js instead of pure Python?**  
Even though you're comfortable with Python, Vercel's native Next.js experience gives us instant deployment, built-in image optimization, streaming AI responses, and a much nicer frontend story. The AI parsing logic is isolated and easy to understand.

## 7. Tech Stack (Final)

| Layer              | Technology                              | Reason |
|--------------------|-----------------------------------------|--------|
| Framework          | Next.js 15 (App Router) + TypeScript   | Vercel-native, streaming, fast |
| Styling            | Tailwind CSS + shadcn/ui + dark mode   | Pinterest look in hours |
| Auth & Database    | Supabase (Postgres + Auth + Storage)   | Free tier, secure, real-time |
| AI SDK             | Vercel AI SDK (`@ai-sdk/openai` compatible) | Works perfectly with OpenCode Go endpoint |
| Masonry Grid       | Tailwind CSS Grid + `masonry-css` or pure CSS | True Pinterest feel |
| Image Optimization | Next.js `<Image>` + Supabase Storage   | Fast loading |
| Deployment         | Vercel (Hobby plan)                    | One-click deploys |

## 8. Database Schema (Supabase)

**Table: `recipes`**
- `id` (uuid, pk)
- `user_id` (uuid, fk → auth.users)
- `title` (text)
- `ingredients` (jsonb or text[])
- `instructions` (text)
- `prep_time` (int, minutes)
- `cook_time` (int, minutes)
- `servings` (int)
- `category` (text) — e.g. "main", "dessert"
- `difficulty` (text) — "easy" | "medium" | "hard"
- `rating` (numeric 1-5)
- `is_favorite` (boolean)
- `image_url` (text) — Supabase storage URL or external
- `source_url` (text, optional)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

Row Level Security: users can only read/write their own rows.

## 9. AI Integration Details

- **Provider:** OpenCode Go endpoint + MiniMax M2.7 (user provides API key)
- **Prompt strategy:** Carefully engineered system prompt that returns strict JSON with all required fields + confidence scores
- **Image uploads:** Client-side or edge OCR → text → M2.7 for structuring (phone image discarded after processing)
- **URL handling:** Server-side fetch → extract main content + hero image URL → send to M2.7
- **Streaming:** User sees live token-by-token parsing for delight

## 10. Design & UX Guidelines

- **Theme:** Dark mode by default with warm amber accents, user can toggle to light mode
- **Theme storage:** localStorage only (device-specific, syncs per-device)
- **Layout:** Masonry grid using masonry-css library for true Pinterest feel
- **Typography:** Clean, modern sans-serif; generous whitespace
- **Cards:** Rounded corners, subtle hover lift, category colored badge, time + difficulty icons
- **Mobile-first:** Works perfectly on phone (you'll add recipes from your camera)
- **Categories:** Fixed dropdown (starter, main, dessert, side, breakfast, snack)

## 10b. Security & Auth Decisions

- **API key storage:** Client-side encrypted with user-derived key (PBKDF2 + AES-GCM)
- **Email verification:** Required on signup
- **Password recovery:** Full email-based reset flow implemented
- **Auth flow:** Supabase Auth with email + password

## 11. Deployment & Cost

- **Hosting:** Vercel (free)
- **Database/Storage:** Supabase free tier (more than enough for personal + small group use)
- **AI Cost:** Your existing OpenCode Go subscription only
- **Total monthly cost at MVP scale:** $0

## 12. Roadmap

**MVP (v1.0)** — What this document describes  
**v1.1** — Manual editing, AI image generation button, basic sharing  
**v2.0** — Meal planner, nutrition, tags, notes, public collections

## 13. Implementation

See `tasks/` directory for phased implementation plan.

## 14. Success Criteria

- I can add a recipe from a phone photo or URL in under 15 seconds  
- The masonry grid looks genuinely beautiful and fun to scroll  
- Everything feels fast and polished  
- Zero ongoing cost beyond my AI subscription