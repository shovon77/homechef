# Chef detail page desktop/tablet improvement plan

The chef detail page (`app/chef/ChefDetailView.tsx`) shows a single chef with a sidebar (photo, name, cuisine, bio, location, rating) and main content (Dishes / Reviews tabs). This plan improves desktop/tablet use of space while keeping the current mobile experience unchanged.

---

## Critical: preserve mobile experience

**The mobile view is final and must not be broken or changed.**

- All improvements apply **only when `!isMobile`** (viewport width ≥ 768px). Mobile (width < 768) keeps the **exact** current layout, styles, and behavior.
- Use conditional layout and styles (e.g. `isMobile ? ... : ...` or `!isMobile && ...`). Never replace mobile behavior; only add desktop/tablet variants.
- Before merging: verify at 375px and 767px — sidebar on top, tabs, horizontal dish scrolls (Newly added, Best-sellers, All dishes), review form and list, disclaimer. Must match current production.

---

## Current state (summary)

- **Breakpoint:** Single `isMobile = width < 768`. No tablet or desktop-specific constants.
- **Container:** Already has `maxWidth: 1280`, `alignSelf: 'center'`, and `paddingHorizontal: theme.spacing['4xl']` on web (40px). Matches app-wide content width.
- **Layout:** Uses `Platform.select` + `isMobile`:
  - Web and width ≥ 768: row layout — sidebar left (33.333%, maxWidth 384, sticky), main right (66.666%).
  - Web and width < 768: column (layoutMobile) — sidebar full width, then main content.
  - Native: column by default.
- **Sidebar:** Chef card (image + info). Sticky on web when desktop. Mobile: full width, not sticky. Good as-is.
- **Main content:** Tabs (Dishes | Reviews), then content. Dishes tab has three sections:
  - **Newly added meals** — horizontal `ScrollView`, cards 180px wide (`dishCardHorizontal`).
  - **Best-sellers now** — same horizontal scroll, 180px cards.
  - **All dishes** — same horizontal scroll, 180px cards.
- **Reviews tab:** Review form (rating + comment) and list of review cards. Single column. Fine for all breakpoints.
- **Unused styles:** `dishesGrid`, `dishCard` (with web 23% width) exist but are not used; all dish sections use horizontal scroll only.

**Desktop/tablet gaps:**

1. All three dish sections are horizontal scroll only. On wide screens, a grid would show more dishes at once and use space better.
2. No tablet breakpoint (e.g. 768–1024) for optional 2-column vs 3–4-column grid.
3. Section titles are already consistent (one `sectionTitle` style). No change needed.

---

## Goals

1. **Keep mobile identical** — same sidebar-on-top, horizontal scrolls, tabs, review form/list.
2. **Better use of space on desktop/tablet** — grid layout for dish sections when `!isMobile` (optional: 2 columns tablet, 3–4 desktop).
3. **Consistent breakpoints** — add `isTablet` / `isDesktop` for clarity and future tweaks.
4. **No regression** — sidebar stays sticky, container stays 1280px, padding unchanged unless we explicitly align with homepage.

---

## Plan (concrete steps)

### 1. Breakpoints

- In `ChefDetailView.tsx`, define:
  - `isTablet = width >= 768 && width < 1024`
  - `isDesktop = width >= 1024`
- Keep `isMobile = width < 768`. Use `!isMobile` (or `isTablet || isDesktop`) for any new desktop/tablet-only layout.

### 2. Container and layout

- **Mobile:** No change. Keep current container padding and layout (column, sidebar then main).
- **Desktop/tablet:** Already good — `maxWidth: 1280`, row layout, sticky sidebar. Optional: leave padding as `theme.spacing['4xl']` or align to `theme.spacing.xl` for consistency with homepage; low priority.

### 3. Dish sections (Newly added, Best-sellers, All dishes)

- **Mobile:** Do not change. Keep the three horizontal `ScrollView`s and `dishCardHorizontal` (180px). Same refs and structure.
- **Desktop/tablet only:** For each section, when `!isMobile`, render a **grid** instead of horizontal scroll:
  - Container: `flexDirection: 'row'`, `flexWrap: 'wrap'`, gap (e.g. `theme.spacing.md` or `theme.spacing.lg`).
  - Each dish: reuse `DishCard` with `variant="explore"` inside a wrapper. Wrapper width: e.g. `flex: 1`, `minWidth: 200` (or percentage `33.33%` / `25%` for 3–4 columns). Use a single grid style for all three sections so "Newly added", "Best-sellers", and "All dishes" look consistent.
  - Optional: `isTablet` → 2 columns (e.g. `minWidth: 280`), `isDesktop` → 3–4 columns (e.g. `minWidth: 200`).
- Implementation: conditional render — `isMobile ? (current ScrollView with dishCardHorizontal) : (View with grid + same DishCard mapping)`. Same data (newlyAddedDishes, bestSellerDishes, dishes); only the wrapper and layout change.

### 4. Section titles

- Already one style (`sectionTitle`). No change. If we later add a second style for a section, ensure desktop section titles stay the same size (same approach as homepage).

### 5. Reviews tab

- **Mobile:** No change.
- **Desktop/tablet:** Optional — constrain review form width (e.g. `maxWidth: 480`) when `!isMobile` so the form doesn’t stretch too wide on ultra-wide screens. Low priority.

### 6. Disclaimer

- No change. Stays full width below content.

### 7. Testing and polish

- **Desktop/tablet:** Test at 768px, 1024px, 1280px. Confirm sidebar sticky, main content scrollable, dish grids show 2–4 columns, no horizontal overflow.
- **Mobile (mandatory before merge):** Test at 375px and 767px. Confirm: sidebar on top, three horizontal dish scrolls (180px cards), tabs, review form and list, disclaimer. Must match current production.

---

## Layout bug fixes (desktop/tablet)

These address the "broken" layout: vertical section title, truncated disclaimer, and clipped dish text.

**Root cause:** On web, the main content column (66.666%) had no `minWidth` and could shrink in the flex row, squeezing the section title into a narrow strip (text wrapping one character per line) and truncating the disclaimer and card content.

**Fixes applied:**

1. **mainContent (web):** Add `minWidth: 320` and `flexShrink: 0` so the main column never collapses. Keeps section title and content in a usable width.
2. **sectionBlock:** Add `width: '100%'` so each section uses the full width of the main content area.
3. **sectionTitle:** Add `width: '100%'` so the title is not squeezed; text stays horizontal.
4. **contentScroll:** Add `width: '100%'` and `minWidth: 0` so the scroll area has a defined width and flex children can size correctly.
5. **dishGridDesktop:** Add `width: '100%'` so the grid uses full width. **dishCardGridWrapper:** Add `maxWidth: 280` so grid items don’t over-grow on very wide screens and layout stays predictable.
6. **disclaimerBlock:** Add `alignSelf: 'stretch'` and `flexShrink: 0` so the disclaimer stays full width and is not squeezed by the row layout; disclaimer text can wrap normally.

If vertical title or truncation reappears, re-check that no parent has `overflow: 'hidden'` or a fixed narrow width without the above safeguards.

---

## Suggested implementation order

Each phase: implement only for `!isMobile`; after each phase, confirm mobile is unchanged.

1. **Phase 1 – Breakpoints**
   - Add `isTablet` and `isDesktop` (and optional `CONTENT_MAX_WIDTH` if we want a shared constant with homepage).
   - **Check:** Mobile unchanged.

2. **Phase 2 – Dish sections grid (desktop/tablet)**
   - For "Newly added meals", "Best-sellers now", and "All dishes": when `!isMobile`, render a grid (View with flexWrap, dish wrappers with flex + minWidth) instead of horizontal ScrollView. Reuse existing `DishCard` and data.
   - **Check:** Mobile still has three horizontal scrolls, 180px cards.

3. **Phase 3 – Polish (optional)**
   - Optional: review form maxWidth on desktop. Optional: align container padding with homepage. Then test all breakpoints.
   - **Final check:** Full mobile regression.

---

## Files to touch

- **`app/chef/ChefDetailView.tsx`** — Breakpoints, conditional grid vs horizontal scroll for the three dish sections. Optionally review form maxWidth and container padding.

No new components required; reuse `DishCard` and existing section structure. The existing `dishesGrid` / `dishCard` styles (web 23% width) could be reused or replaced by new grid styles that apply only when `!isMobile`.
