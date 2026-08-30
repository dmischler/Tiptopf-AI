# Frontend Implementation Addendum – Phase 1, 2 & 3 (Tiptopf-AI)

> **Historical.** Current work is [`POST_REVIEW_HARDENING_PLAN.md`](POST_REVIEW_HARDENING_PLAN.md).
>
> **Status: COMPLETED** ✅ (2026-04-26)

> **Phase 2 Addendum (2026-04-26): COMPLETED** ✅

> **Phase 3 (2026-04-26): COMPLETED** ✅

---

## Phase 2 Addendum: Desktop Navigation + Profile-Based API Configuration + Feature Polish

This follow-up addendum documents the architecture updates requested after Phase 1.

### A) Desktop Navigation

- Added `src/components/layout/top-nav.tsx` for desktop (`md` and above)
- Extracted shared navigation metadata to `src/components/layout/nav-items.ts`
- Updated `src/components/layout/bottom-nav.tsx` to reuse shared nav items
- Mounted `TopNav` in `src/app/layout.tsx`
- Kept bottom nav mobile-only (`md:hidden`) and desktop top nav visible (`hidden md:block`)
- Reduced desktop bottom spacing on main views with `md:pb-8`

### B) Remove Auth/Landing Artifacts

- Removed unused auth routes:
  - `src/app/login/page.tsx`
  - `src/app/signup/page.tsx`
  - `src/app/forgot-password/page.tsx`
  - `src/app/reset-password/page.tsx`
- Root route continues to redirect to `/library` (no standalone landing/auth flow)

### C) API Keys + Model Config in Profile UI (No Docker Env Dependency)

- Added persistent settings type `AppSettings` in `src/types/index.ts`
- Extended local store (`src/lib/local/store.ts`) with:
  - `settings` object in `tiptopf.json`
  - `getSettings()`
  - `updateSettings()`
- Added server actions in `src/app/actions/settings.ts`
- Added profile UI form in `src/components/profile/settings-form.tsx`
- Extended profile page (`src/app/profile/page.tsx`) with full API/model configuration form
- Keys are now managed in `/profile` and persisted in local store (currently unencrypted)

### D) AI Layer Refactor (Settings-Driven, Not Env-Driven)

- Refactored AI helpers to accept explicit settings parameters:
  - `src/lib/ai/client.ts`
  - `src/lib/ai/extractor.ts`
  - `src/lib/ai/image-handler.ts`
  - `src/lib/ai/image-search.ts`
- Updated extraction action orchestration in `src/app/actions/extract-recipe.ts` to:
  - load keys/config from local settings
  - return user-facing errors when keys are missing
  - remove runtime dependency on API key env vars

### E) Environment + Deployment Docs Cleanup

- Updated:
  - `.env.example`
  - `.env.docker.example`
  - `docker-compose.yml`
  - `README.md`
  - `docs/local-pi-deployment.md`
  - `AGENTS.md`
- API key env vars are no longer required; only `DATA_DIR` remains required.

### F) Additional Phase 2 Feature Polish

- **Time slider filter** in `FilterBar` — replaced the simple quick-filter toggle with a `Slider` component (shadcn/ui) allowing dynamic max-time filtering.
- **Tag autocomplete** in `RecipeDetail` edit mode — shows a dropdown with existing tag suggestions while typing.
- **Collection markdown export** — added `Exportieren` button on collection detail pages that generates a `.md` file with all recipes.
- **AI-generated tags** — extraction prompts now request up to 5 German tags; tags are persisted on save and shown in cards/detail.

---

## Phase 3: AI Tag Extraction, Advanced Filters, Export & Backup

### A) AI Tag Extraction Loop Completion

- **Fixed tag propagation** through the add-recipe flow:
  - Extended `EditableRecipePreview` in `src/components/add-recipe/preview.tsx` with `tags: string[]`
  - Added `TagsEditor` sub-component in preview for add/remove + autocomplete
  - Updated `src/components/add-recipe/modal.tsx` to pass tags through to `saveRecipe`
- **Refined prompts** in `src/lib/ai/prompts.ts`:
  - Stricter step separation: "ONE step per line, numbered with 1., 2., 3."
  - Explicit translation rule: "ALL output text to German"
  - Explicit metric conversion rule with examples
  - Tag instruction preserved: up to 5 German tags

### B) FilterBar – Difficulty + Favorites

- Added **difficulty filter chips** (Leicht / Mittel / Schwer) to `FilterBar`
- Added **favorites-only toggle** (heart icon chip) to `FilterBar`
- Updated `LibraryView` filter logic with AND-combination for difficulty + favorites

### C) Export & Backup

- **Individual recipe markdown export**:
  - Added `buildRecipeMarkdown()` and `recipeMarkdownFilename()` to `src/lib/export.ts`
  - Added Export button in `RecipeDetail` view mode (downloads `.md`)
- **Full store backup/restore**:
  - Added `exportStoreJson()` and `importStoreJson()` to `src/lib/local/store.ts`
  - Added server actions `exportStoreAction` / `importStoreAction` in `src/app/actions/settings.ts`
  - Added `BackupRestoreSection` client component in `src/components/profile/backup-restore.tsx`
  - Integrated into `/profile` page

### D) Print Stylesheet

- Added `@media print` styles to `src/app/globals.css`:
  - Hides navigation and fixed UI elements
  - Forces white background and black text
  - Prevents page breaks inside images and lists

---

This addendum provides **detailed frontend specifications** to complement the main plan. All text, labels, and UI elements are in **German** as per project design.

---

## 1. FilterBar Component (Replaces CategoryFilter)

**File:** `src/components/library/filter-bar.tsx`

**Purpose**  
Unified filter bar that combines:
- Search input
- Category chips (vorspeise, hauptgericht, dessert, etc.)
- Computed "Schnell (<30min)" chip
- Dynamic German tag chips (only shown if at least one recipe has that tag)
- **Time slider** for dynamic max-time filtering

**Props**
```ts
interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeCategory: RecipeCategory | null;
  onCategoryChange: (category: RecipeCategory | null) => void;
  activeTags: string[];
  onTagToggle: (tag: string) => void;
  maxTime: number | null;
  maxTimeLimit: number;
  onMaxTimeChange: (value: number | null) => void;
  availableTags: string[]; // dynamically computed from recipes
}
```

**Key UI Elements**
- Search input with magnifying glass icon (lucide-react)
- Horizontal scrollable chip row:
  - "Alle"
  - Category chips (colored differently)
  - "Schnell (<30min)" (special blue chip, toggles `maxTime = 30`)
  - Dynamic tag chips (e.g. vegetarisch, vegan, glutenfrei) — green/purple/etc.
- Active filters are highlighted with primary color + check icon
- **Time slider** (shadcn/ui `Slider`) with reset button; range is `0 … maxTimeLimit` in 5-minute steps

**Integration**
- Used in `src/app/library/page.tsx` (or wherever LibraryView lives)
- Filters are applied in the parent component using the existing recipe list

---

## 2. RecipeCard Updates

**File:** `src/components/library/recipe-card.tsx` (update existing)

**Changes**
- Add small tag chips below the title (max 3 visible, rest as "+2")
- Use the same color mapping as FilterBar for consistency
- Keep existing image, title, time badges, favorite heart

**Example Tag Rendering**
```tsx
<div className="flex flex-wrap gap-1 mt-2">
  {recipe.tags.slice(0, 3).map(tag => (
    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
      {tag}
    </span>
  ))}
  {recipe.tags.length > 3 && (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
      +{recipe.tags.length - 3}
    </span>
  )}
</div>
```

---

## 3. RecipeDetail – Tag Editing + Autocomplete

**File:** `src/components/library/recipe-detail.tsx` (update existing modal/page)

**Changes in Edit Mode**
- Add a new section: **"Tags"**
- Input field + "Hinzufügen" button (comma or Enter to add)
- Display current tags as removable chips
- **Tag autocomplete dropdown** — while typing, up to 6 matching existing tags are shown in a popover below the input
- On save, call the existing `updateRecipe` action with normalized tags

**UI Pattern**
- Similar to how ingredients are edited (list + add/remove)
- Use the `normalizeTags` helper before saving

---

## 4. Bottom Navigation

**File:** `src/components/layout/bottom-nav.tsx` (new)

**Design**
- Fixed bottom bar on mobile (`md:hidden`)
- Three items with icons (lucide-react):
  - **Bibliothek** → `/library` (book-open icon)
  - **Sammlungen** → `/collections` (folder icon)
  - **Profil** → `/profile` (user icon)
- Active state with primary color
- Safe-area padding for notched phones

**Mounting**
- Add to `src/app/layout.tsx` (inside the main layout, after `<main>`)

---

## 5. Collections Feature

### 5.1 Collection List Page

**File:** `src/app/collections/page.tsx` (new)

**Layout**
- Top bar with title "Sammlungen" + "Neue Sammlung" button (opens modal)
- Masonry grid of collection cards (name + recipe count + cover image from first recipe)
- Empty state: "Noch keine Sammlungen. Erstelle deine erste!"

### 5.2 Collection Card Component

**File:** `src/components/collections/collection-card.tsx` (new)

**Props**
```ts
interface CollectionCardProps {
  collection: Collection;
  recipeCount: number;
  coverImage?: string;
  onClick: () => void;
}
```

### 5.3 Collection Detail Page

**File:** `src/app/collections/[id]/page.tsx` (new dynamic route)

**Features**
- Header with collection name + "Bearbeiten" / "Löschen" buttons
- Masonry grid showing only recipes in this collection
- "Rezept hinzufügen" button that opens a modal with all recipes (searchable)
- **"Exportieren" button** — generates a Markdown file (`{slug}.md`) containing all recipes in the collection
- Back button to collections list

### 5.4 "Add to Collection" in Recipe Detail

**Location:** Inside `RecipeDetail` component (edit or view mode)

- New dropdown or modal: "Zur Sammlung hinzufügen"
- Lists all existing collections + "Neue Sammlung erstellen"
- On selection, calls `addRecipeToCollection` action

---

## 6. State Management Notes

- Keep using existing local store (`src/lib/local/store.ts`)
- For filters, use React `useState` in the Library page (or a small custom hook `useRecipeFilters`)
- Collections can be managed with the same store actions (already planned in main document)

---

## 7. Styling Guidelines (Consistent with Existing)

- Use Tailwind v4 + shadcn/ui components where possible
- Chip style: `rounded-full px-3 py-1 text-sm font-medium`
- Primary color: warm orange/amber (matches foodie theme)
- Mobile-first: all components must look good on 360px–768px screens
- Dark theme throughout

---

## 8. File Summary (New or Modified)

| File                                      | Action     | Priority | Status |
|-------------------------------------------|------------|----------|--------|
| `src/components/library/filter-bar.tsx`   | New        | High     | ✅ Done |
| `src/components/library/recipe-card.tsx`  | Modify     | High     | ✅ Done |
| `src/components/library/recipe-detail.tsx`| Modify     | High     | ✅ Done |
| `src/components/layout/bottom-nav.tsx`    | New        | Medium   | ✅ Done |
| `src/components/layout/top-nav.tsx`       | New        | Medium   | ✅ Done |
| `src/components/layout/nav-items.ts`      | New        | Medium   | ✅ Done |
| `src/app/collections/page.tsx`            | New        | Medium   | ✅ Done |
| `src/app/collections/[id]/page.tsx`       | New        | Medium   | ✅ Done |
| `src/components/collections/*`            | New        | Medium   | ✅ Done |
| `src/components/profile/settings-form.tsx`| New        | Low      | ✅ Done |
| `src/app/profile/page.tsx`                | New        | Low      | ✅ Done |
| `src/app/actions/settings.ts`             | New        | Medium   | ✅ Done |
| `src/types/index.ts`                      | Modify     | High     | ✅ Added `tags` to Recipe, `Collection`, `AppSettings` types |
| `src/lib/local/store.ts`                  | Modify     | High     | ✅ Tags + collections + settings CRUD |
| `src/lib/utils.ts`                        | Modify     | High     | ✅ Added `normalizeTags` helper |
| `src/lib/ai/client.ts`                    | Modify     | High     | ✅ Settings-driven config |
| `src/lib/ai/extractor.ts`                 | Modify     | High     | ✅ Tags support |
| `src/lib/ai/image-handler.ts`             | Modify     | High     | ✅ Tags support |
| `src/lib/ai/prompts.ts`                   | Modify     | High     | ✅ German tags in extraction prompt |
| `src/lib/export.ts`                       | New        | Low      | ✅ Markdown export utilities |
| `src/app/actions/recipe.ts`               | Modify     | High     | ✅ Tags support in edit/restore |
| `src/app/actions/add-recipe.ts`           | Modify     | High     | ✅ Tags support in save |
| `src/app/actions/collections.ts`          | New        | Medium   | ✅ Server actions for collections |
| `src/app/actions/extract-recipe.ts`       | Modify     | High     | ✅ Settings-driven extraction |
| `src/components/library/library-view.tsx` | Modify     | High     | ✅ Integrated FilterBar + time slider |
| `src/app/layout.tsx`                      | Modify     | Medium   | ✅ Added TopNav + BottomNav |
| `src/components/ui/slider.tsx`            | New        | High     | ✅ shadcn/ui slider component |
| `src/components/add-recipe/preview.tsx`   | Modify     | High     | ✅ Tag editing in add-recipe preview |
| `src/components/add-recipe/modal.tsx`     | Modify     | High     | ✅ Tags propagated to save action |
| `src/lib/export.ts`                       | Modify     | Medium   | ✅ Individual recipe markdown export |
| `src/components/profile/backup-restore.tsx`| New       | Medium   | ✅ Backup/restore UI |
| `src/app/globals.css`                     | Modify     | Low      | ✅ Print stylesheet |

---

**Next Step Recommendation**  
Phase 1, 2 & 3 are fully implemented. Future enhancements could include:
- Recipe import from Markdown or JSON
- Full-text search across ingredients and instructions
- Image optimization pipeline (WebP conversion, responsive srcset)
- Encrypted storage for API keys
