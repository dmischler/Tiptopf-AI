# Frontend Implementation Addendum – Phase 1 (Tiptopf-AI)

> **Status: COMPLETED** ✅ (2026-04-26)

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

**Props**
```ts
interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  activeTags: string[];
  onTagToggle: (tag: string) => void;
  showQuickFilter: boolean;
  onQuickFilterToggle: () => void;
  availableTags: string[]; // dynamically computed from recipes
}
```

**Key UI Elements**
- Search input with magnifying glass icon (lucide-react)
- Horizontal scrollable chip row:
  - "Alle"
  - Category chips (colored differently)
  - "Schnell (<30min)" (special blue chip, only active when filter is on)
  - Dynamic tag chips (e.g. vegetarisch, vegan, glutenfrei) — green/purple/etc.
- Active filters are highlighted with primary color + check icon

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

## 3. RecipeDetail – Tag Editing

**File:** `src/components/recipe/recipe-detail.tsx` (update existing modal/page)

**Changes in Edit Mode**
- Add a new section: **"Tags"**
- Input field + "Hinzufügen" button (comma or Enter to add)
- Display current tags as removable chips
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
| `src/app/collections/page.tsx`            | New        | Medium   | ✅ Done |
| `src/app/collections/[id]/page.tsx`       | New        | Medium   | ✅ Done |
| `src/components/collections/*`            | New        | Medium   | ✅ Done |
| `src/types/index.ts`                      | Modify     | High     | ✅ Added `tags` to Recipe, `Collection` type |
| `src/lib/local/store.ts`                  | Modify     | High     | ✅ Tags + collections CRUD |
| `src/lib/utils.ts`                        | Modify     | High     | ✅ Added `normalizeTags` helper |
| `src/app/actions/recipe.ts`               | Modify     | High     | ✅ Tags support in edit/restore |
| `src/app/actions/add-recipe.ts`           | Modify     | High     | ✅ Tags support in save |
| `src/app/actions/collections.ts`          | New        | Medium   | ✅ Server actions for collections |
| `src/components/library/library-view.tsx` | Modify     | High     | ✅ Integrated FilterBar |
| `src/app/layout.tsx`                      | Modify     | Medium   | ✅ Added BottomNav |
| `src/app/profile/page.tsx`                | New        | Low      | ✅ Basic profile page |

---

**Next Step Recommendation**  
Phase 1 is fully implemented. Future enhancements could include:
- AI-generated tags during recipe extraction
- Collection sharing or export
- Advanced filtering (prep time range, ingredient search)
- Recipe tags autocomplete based on existing tags