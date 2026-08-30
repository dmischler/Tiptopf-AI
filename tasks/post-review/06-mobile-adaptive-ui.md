# Phase 06 — Mobile-first, adaptive desktop (zoom stays off)

**Status:** DONE  
**Depends on:** 04 (recipe page exists), 05 (components are splittable)  
**Goal:** Phone is the primary device and feels like an app. Desktop is a real layout, not a stretched phone. Pinch-zoom remains disabled; type and targets make it unnecessary.

---

## Locked: zoom

Do **not** remove or raise `maximumScale: 1` in `src/app/layout.tsx`.

```ts
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // KEEP
  viewportFit: 'cover',
  themeColor: '#0f0f0f',
}
```

Because zoom is off, this phase is also the **readability** phase. If a cook cannot read a step at default scale on a 360px phone, that is a bug in this phase, not a reason to enable zoom.

### Readability bar (acceptance)

On a 360×800 CSS-pixel viewport, default font scaling:

- Recipe title: ≥ 24px
- Ingredient line: ≥ 16px
- Instruction step body: ≥ 16px (18px preferred)
- Step number: clearly distinct, not `text-xs`
- No essential control smaller than 44×44
- Tag chips may stay small (`text-xs`) because they are not the cook path

Increase spacing rather than shrinking type to fit.

---

## 1. One breakpoint table

Use Tailwind defaults; **stop JS `matchMedia('(max-width: 639px)')`**.

| Prefix | Width | Chrome | Recipe | Add-recipe | Grid |
|---|---|---|---|---|---|
| (base) | 0–639 | Bottom nav | Full page, 1 col content | **Sheet** | 1 col |
| `sm` | 640–767 | Bottom nav | Full page | Sheet | 2 col |
| `md` | 768–1023 | Top nav, no bottom nav | Full page, wider measure | **Modal** | 3 col |
| `lg` | 1024+ | Top nav | Two-pane view (image+meta \| ingredients+steps) | Modal | 4 col |

**Short landscape phones** (`md` width but height ~390): top nav + short viewport is the worst layout in the product.

Add a CSS / Tailwind approach:

- Prefer `@media (max-height: 500px) and (pointer: coarse)` to keep **bottom nav + compact header** even if width ≥ 768.
- Or: keep bottom nav for `md` when `max-height` is small via a custom variant.

If a custom variant is too much, simpler rule: **do not switch to top nav unless `min-width: 768px` AND `min-height: 600px`**. Implement with a `useMedia` only if CSS cannot hide/show both navs (it can: `max-md:flex` plus `md:min-h-[600px]:flex` — Tailwind v4 may need an arbitrary variant).

Document the chosen mechanism in a comment on `bottom-nav.tsx` / `top-nav.tsx`.

---

## 2. Safe areas (iOS standalone + `viewport-fit: cover`)

`viewportFit: 'cover'` is already set. Bottom padding exists on mains. **Top does not.**

### Work

`src/app/layout.tsx` body or a wrapper:

```
pt-[env(safe-area-inset-top)]
```

Do not double-pad with `py-8` in a way that wastes space. Pattern:

- `body`: `pt-[env(safe-area-inset-top)]` only.
- `main` pages: keep `px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))] md:pb-8`.
- In `display-mode: standalone`, reduce `py-8` to `py-4` if easy (`@media (display-mode: standalone)` in `globals.css`).

Bottom nav: already `pb-[env(safe-area-inset-bottom)]`. Add `pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]` for landscape notch.

FAB (`expandable-fab.tsx:63`):

```
right: max(1.5rem, env(safe-area-inset-right))
bottom: calc(5rem + env(safe-area-inset-bottom))  // keep
md:bottom-6
```

Masonry/list: add spacer `h-24` at the end of the library grid so the last card is not under the FAB.

Toaster: `position="top-right"` sits in the Dynamic Island. Use `top-center` on small screens or add `top: env(safe-area-inset-top)`.

Sheet for **add-recipe** (`dialog.tsx` `presentation="sheet"`): add `pb-[env(safe-area-inset-bottom)]` on the sheet itself. Recipe **view** is a page now, so the old sheet home-indicator bug is gone.

### iOS PWA meta

Layout today: `mobile-web-app-capable` only (`layout.tsx:35`). Add:

```
apple-mobile-web-app-capable=yes
apple-mobile-web-app-status-bar-style=black-translucent
apple-mobile-web-app-title=Tiptopf
```

Keep `maximumScale: 1`.

---

## 3. Add-recipe: German, camera-first, sheet on small screens

### Copy (must all be German)

| Current | Target |
|---|---|
| Dialog title `Add recipe` (`modal.tsx:456`) | `Rezept hinzufügen` |
| Description English | `Foto aufnehmen oder URL einfügen. Die KI strukturiert das Rezept.` |
| `URL from clipboard detected` | `URL aus der Zwischenablage erkannt` |
| Image upload drag-and-drop hero | Secondary. Primary: `Foto aufnehmen` + `Bild wählen` |
| `Choose image` / `Use camera` / `Extract recipe` | `Bild wählen` / `Foto aufnehmen` / `Rezept erkennen` |
| Streaming stages English (`streaming-progress.tsx`) | `Seite laden` / `Rezept erkennen` / `Bild suchen` |
| Image selection modal English | `Bild auswählen`, photographer credit can stay as data |
| `Failed to save recipe.` | `Rezept konnte nicht gespeichert werden.` |
| Recipe view `No image available` | `Kein Bild vorhanden` |
| `Edit recipe` sr-only | `Rezept bearbeiten` |
| `Close` sr-only in dialog | `Schließen` |
| Rating `Rate N stars` | `N von 5 Sternen` |
| Favorite English aria | `Als Favorit markieren` / `Aus Favoriten entfernen` |
| `error.tsx` English | German |
| `layout.tsx` metadata English | German title/description |
| Profile `zurueck` | `zurück` |
| Delete copy Sie | du-form, and it **can** be undone (Phase 02) |

Do a grep for obvious English user strings: `Add recipe`, `Failed to`, `Please `, `No image`, `No time`, `Something went wrong`, `Extract`, `Drag and drop`.

### Camera-first layout (base/sm)

`image-upload.tsx` already has `capture="environment"` (`:141`). Make that button **primary** (filled), gallery secondary (outline). Drag-and-drop hint: `hidden md:block`.

Manual form file input: add a camera capture control too, or reuse `ImageUpload` / `ImagePicker`.

### Sheet vs modal

`AddRecipeModal` `DialogContent`:

```
presentation={/* css cannot easily pass here */}
```

Use CSS-only if possible: sheet classes by default, `md:` modal centering. The current `presentation` prop is JS. Options:

1. CSS: always use sheet layout under `md`, modal layout `md+` on the same component (Tailwind variants on `DialogContent`).
2. `useMediaQuery('md')` **one** shared hook, same breakpoint as nav — not 639px.

Prefer (1) so SSR and first paint match. `dialog.tsx` can apply both:

```
className="fixed inset-x-0 bottom-0 ... md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 ..."
```

Then **delete** `presentation` / `isMobile` state if nothing else needs it.

Max height: `max-h-[min(92svh,1000px)]` on small; desktop modal `max-h-[calc(100vh-2rem)]`. Safe-area padding on the sheet.

Image picker nested dialog: render as **sibling** (recipe-detail already does this for delete). Do not portal-in-portal inside add modal (`modal.tsx:546`).

---

## 4. Recipe page layout (adaptive)

### base/sm

- Hero image: taller than `h-40` — `aspect-[4/3] max-h-[40vh]` so it is visible but does not eat the whole cook view. **Do not** shrink instruction type to compensate.
- Content measure: full width with `px-4`.
- Actions: primary `Auf die Einkaufsliste` full-width 44px; secondary (print, export, quelle, sammlung, löschen) in a wrap row or overflow menu.
- Servings stepper: 44px buttons (Phase 05 component).

### lg two-pane

```
grid lg:grid-cols-[minmax(280px,38%)_1fr]
```

Left: sticky image + title + badges + times + servings + actions.  
Right: ingredients + instructions + notes.

Do not keep a 32rem centered column on a 80rem screen.

### Edit page

- `md:grid-cols-2` for times/category as now.
- Textareas min-height comfortable (`min-h-40` instructions).
- Sticky save bar **above** home indicator: `bottom-0 pb-[env(safe-area-inset-bottom)]` on mobile, not overlapping nav — edit page still has bottom nav. Put save in the document flow at the bottom of the form **or** sticky just above bottom nav (`bottom-[calc(4rem+env(safe-area-inset-bottom))]`).

---

## 5. Library chrome on the phone

Filters today eat ~250–300px (`text-3xl` + `py-8` + search + chips + slider + sort).

**Mobile compact:**

- Title `text-2xl`; subtitle can hide on base (`hidden sm:block`).
- Search always visible.
- Chip row: **44px** chips (`px-3 py-2` not `py-1`). Horizontal scroll OK. Add fade hint (`mask-image` or `scrollbar-hide` **defined in CSS** — today `scrollbar-hide` is used in `filter-bar.tsx:86` but **not defined**).
- Time slider: collapse behind a “Zeit” chip; expanded on `md+` always. Saves vertical space on phone.
- Sort: icon button is fine.

`scrollbar-hide` utility: add to `globals.css`:

```css
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }
```

---

## 6. Grid: stop pretending CSS columns are Pinterest

VISION wanted masonry-css. CSS `columns` is column-major and fights tab order.

**This phase (pragmatic):** switch library + collections to **row-major CSS grid**:

```
grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4
```

Card image: `aspect-[4/3]` is OK for a grid (not fake masonry). If a card has no image, keep a placeholder block the same aspect so the grid is even.

True variable-height Pinterest is Phase 11. Do not spend this phase on JS masonry.

Keep `break-inside-avoid` only if columns remain somewhere; grid does not need it.

---

## 7. Touch targets and hover-only

| Control | Today | Target |
|---|---|---|
| Filter chips | `py-1` ~30px | `min-h-11` (44px) |
| Servings +/− | `h-7 w-7` | `h-11 w-11` |
| Shopping checkbox | `h-7 w-7` | `h-11 w-11` |
| Shopping delete | 16px icon | 44px button |
| Collection remove-from-card | `p-1.5` hover-only | 44px, always visible on touch (`bg-black/50`) |
| Bottom nav | ~50px, 4 labels | keep; shorten **Einkaufsliste** → **Einkauf** with `aria-label="Einkaufsliste"` |
| Bottom nav active | color only | `aria-current="page"` |
| Slider thumb | `size-3` | keep expanded hit (`-inset-2`) and verify 44px |
| FAB actions | `h-12 w-12` | OK |
| FAB main | `h-14 w-14` | OK |

Rating on **cards**: five 44px stars is a large block and causes mis-taps vs open. On cards use **display-only** stars (no toggle) or a compact read-only row; rating is on the recipe page. This also reduces hover-preview issues (`rating.tsx`).

`FavoriteButton` on cards stays, with `stopPropagation`.

---

## 8. German + du (sweep)

Phase 05/06 grep list in section 3. Also:

- Delete dialog Sie → du
- `StreamingProgress` is not a token stream — title `Rezept wird erkannt` not “Streaming”
- `src/app/error.tsx` full German
- Metadata in `layout.tsx`

No i18n library.

---

## 9. PWA (honest)

| Item | Action |
|---|---|
| Dual manifests `src/app/manifest.json` vs `public/manifest.json` | **One** source. Prefer `src/app/manifest.ts` (Next Metadata API) **or** public only. Delete the other. Align `start_url: /library`, `theme_color: #0f0f0f`, `background_color: #0f0f0f`, icons purpose `any` **and** `maskable` |
| `next.config.js` rewrite `/manifest.webmanifest` | Keep if public file remains; drop if using `app/manifest.ts` |
| Service worker | Do **not** register the current no-op `sw.js` as a “PWA”. Either delete `public/sw.js` or leave unregistered. Offline cache is Phase 11. |
| Installability | Manifest + icons + apple meta from §2 is enough for “Add to Home Screen” |

---

## 10. A11y (without enabling zoom)

- `aria-current="page"` on nav
- Filter chips `aria-pressed`
- Search input: visually hidden `<label>` “Rezepte suchen”
- Skip link optional
- `prefers-reduced-motion`: random draw skips the 5s spin (`random-recipe-drawer.tsx:97-108`); instant pick. Dialog animations can stay short.
- Focus: recipe page is not a focus trap (good). Add-recipe sheet should still trap.
- Bottom nav in DOM: acceptable after main; skip link if easy
- Contrast: keep dark theme; do not introduce light mode

**Do not** treat 1.4.4 Resize text as a ticket to enable pinch-zoom. Compensation is the type scale in this document.

---

## 11. Pull-to-refresh vs other gestures

`pull-to-refresh.tsx` uses document-level non-passive `touchmove`. After Phase 04 there is no recipe-sheet drag fight, but PTR still fights iOS rubber-band and open dialogs.

- Do not attach PTR listeners while a dialog is open.
- Only on `/library` (already wrapped there).
- Keep.

---

## 12. Light mode

Not this phase. `html` stays `className="dark"`. Chips use raw `zinc-800` — a later light mode must replace those with tokens (Phase 11).

---

## Files (primary)

| File | Change |
|---|---|
| `src/app/layout.tsx` | apple meta, German metadata, safe-area, toaster position; **keep maximumScale 1** |
| `src/app/globals.css` | standalone padding, scrollbar-hide, print (from 04), reduced-motion, safe-area helpers |
| `src/components/ui/dialog.tsx` | responsive sheet/modal via CSS; safe-area; German close |
| `src/components/add-recipe/modal.tsx` | German; sheet; sibling image picker |
| `src/components/add-recipe/image-upload.tsx` | camera primary |
| `src/components/add-recipe/streaming-progress.tsx` | German stages |
| `src/components/layout/bottom-nav.tsx` | Einkauf label, aria-current, safe-area x, height media |
| `src/components/layout/top-nav.tsx` | matching visibility rule |
| `src/components/add-recipe/expandable-fab.tsx` | safe-area right; click-outside `touchstart` as well as mousedown |
| `src/components/library/filter-bar.tsx` | 44px chips, collapse slider, scrollbar-hide real |
| `src/components/library/masonry-grid.tsx` | CSS grid row-major |
| `src/components/library/recipe-card.tsx` | read-only rating; German empty time |
| `src/components/recipe/*` | type scale, 44px stepper, lg two-pane on view |
| `src/components/shopping/shopping-list-view.tsx` | 44px check/delete |
| `src/components/collections/collection-detail-view.tsx` | visible remove control |
| `src/app/error.tsx` | German |
| `src/app/manifest.ts` or public manifest | single manifest |
| `src/components/library/random-recipe-drawer.tsx` | reduced-motion skip |

---

## Implementation steps

1. Safe-area + apple meta + German metadata. Verify notch padding. Confirm `maximumScale` still 1.
2. Type scale on recipe view; 44px servings. Read a long recipe on 360px preview.
3. Add-recipe German + camera primary + CSS sheet/modal.
4. Grid + compact filters + real `scrollbar-hide`.
5. Nav breakpoint including short landscape; Einkauf label; aria-current.
6. Touch targets shopping/collections; read-only card ratings.
7. Manifest consolidation. Do not register SW.
8. Reduced-motion on random draw.
9. Browser pass: 360px, 390×844 landscape, 768 tablet, 1280 desktop. Add flow, recipe read, print (from 04), shopping check.

---

## Acceptance

- `maximumScale === 1` still in `layout.tsx`.
- Recipe steps are ≥ 16px on a 360px wide screen; servings buttons are 44px.
- Add-recipe UI is fully German; camera is the primary image CTA; on a phone it is a bottom sheet with safe-area.
- Desktop `lg` recipe is two-pane, not a narrow centered column.
- Landscape short phone does not combine top nav + unusable vertical modal.
- Last library card is not hidden under the FAB.
- Filter `scrollbar-hide` actually hides scrollbars.
- One manifest, `start_url` `/library`.
- No new hover-only essential control.

## Out of scope

- Enabling zoom
- Light mode
- True Pinterest masonry library
- Offline service worker
- Cook-mode keep-awake (Phase 11)
