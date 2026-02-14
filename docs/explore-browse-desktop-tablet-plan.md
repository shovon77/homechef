# Explore (browse) page desktop/tablet improvement plan

The explore page (`app/browse/index.tsx`) shows Dishes, Chefs, and Cuisines tabs with search, sort, and grids. This plan improves desktop/tablet layout and use of space while keeping the current mobile experience unchanged.

---

## Critical: preserve mobile experience

**The mobile view is final and must not be broken or changed.**

- All improvements apply **only when `!isMobile`** (viewport width ≥ 768px). Mobile (width < 768) keeps the **exact** current layout, styles, and behavior.
- Use conditional layout and styles (e.g. `isMobile ? ... : ...` or `!isMobile && ...`). Never replace mobile behavior; only add desktop/tablet variants.
- Before merging: verify at 375px and 767px — header, tabs (Dishes | Chefs | Cuisines), sort, dish grid (2 columns), chef grid (1 column), cuisines grid (2 columns), floating search, pagination. Must match current production.

---

## Current state (summary)

- **Breakpoints:** `isMobile = width < 768`, `isTablet = width >= 768 && width < 1024`. No explicit `isDesktop`; desktop is implied by `!isMobile && !isTablet` or `width >= 1024`.
- **Layout:** Screen with `contentStyle={{ paddingHorizontal: 24, paddingTop: 0 }}`. No max-width container; content spans full viewport on desktop/tablet.
- **Header:** "Pickup homemade meals near you" + subtitle + white divider. `title` fontSize 24 (18 on mobile via `titleMobile`). `headerBlock` has minHeight 96 (web) / 88 (default).
- **Tabs:** Dishes | Chefs | Cuisines + sort control (dropdown). Centered in `tabsWrap` / `tabsRow`.
- **Dishes tab:** Grid with **fixed 2 columns** (`DISHES_GRID_COLUMNS = 2`). Each card `width: 50%` (minus wrapper padding). Same on all breakpoints.
- **Chefs tab:** Grid columns are responsive: `gridColumns = isMobile ? 1 : isTablet ? 3 : 5`. Card width `100 / gridColumns %`. Good for desktop/tablet.
- **Cuisines tab:** Grid with **fixed 2 columns** (`cuisineCardWrapper` width `50%`). Same on all breakpoints.
- **Grid style:** `grid` has `flexDirection: 'row'`, `flexWrap: 'wrap'`, `marginHorizontal: -6`. `cardWrapper` has `paddingHorizontal: 6`, `marginBottom: 16`.
- **Floating search:** Bottom-right FAB that expands to search bar. Already has max width and positioning. No change needed for desktop.

**Desktop/tablet gaps:**

1. **No content max-width:** Content uses full viewport width; no 1280px (or similar) cap like homepage, chef detail, or dish detail. On ultra-wide screens the grid stretches and can look sparse.
2. **Dishes grid:** Always 2 columns. On desktop/tablet, 3–4 columns would use space better.
3. **Cuisines grid:** Always 2 columns (50% width). On desktop/tablet, 3–4 columns would be more balanced.
4. **Header/title:** Could optionally use slightly larger title on desktop for consistency with other pages (low priority).

---

## Goals

1. **Keep mobile identical** — same header, tabs, 2-column dishes, 1-column chefs, 2-column cuisines, floating search, pagination.
2. **Consistent content width** — cap main content at ~1280px and center on desktop/tablet so it aligns with navbar and other pages.
3. **Better grid use on desktop/tablet** — more columns for dishes and cuisines when `!isMobile` (dishes: 3–4, cuisines: 3–4).
4. **Optional:** Add `isDesktop` for clarity; slightly larger header title on desktop (low priority).

---

## Plan (concrete steps)

### 1. Breakpoints

- Add `isDesktop = width >= 1024` for consistency with homepage/chef detail (optional; already have `gridColumns` for chefs).
- Keep `isMobile` and `isTablet` as-is. Use `!isMobile` for any new desktop/tablet-only layout.

### 2. Content container (max-width + center)

- **Mobile:** No change. Do not wrap content in a max-width container when `isMobile`; keep current full-width layout.
- **Desktop/tablet only:** Wrap the content inside Screen (header, tabs, grid, pagination) in a View that has `maxWidth: 1280`, `width: '100%'`, `alignSelf: 'center'`. Apply only when `!isMobile`. This keeps padding from `contentStyle` on the outer Screen and adds an inner wrapper for the cap. Alternative: add a wrapper that only gets `maxWidth` and `alignSelf` when `!isMobile`, so structure stays the same and mobile has no extra wrapper behavior.

### 3. Dishes grid columns

- **Mobile:** Do not change. Keep `DISHES_GRID_COLUMNS = 2` for mobile (i.e. when `isMobile`, use 2 columns).
- **Desktop/tablet only:** Use a responsive column count for dishes, e.g. `dishGridColumns = isMobile ? 2 : isTablet ? 3 : 4`. Render dish cards with `width: `${100 / dishGridColumns}%`` when `!isMobile`, and keep current `100 / DISHES_GRID_COLUMNS` when `isMobile`. So dishes grid shows 2 columns on mobile, 3 on tablet, 4 on desktop.

### 4. Cuisines grid columns

- **Mobile:** Do not change. Keep 2 columns (50% width) when `isMobile`.
- **Desktop/tablet only:** Use responsive width for `cuisineCardWrapper`, e.g. when `!isMobile` use `width: `${100 / cuisineColumns}%`` with `cuisineColumns = isTablet ? 3 : 4`, and keep `width: '50%'` when `isMobile`. So cuisines: 2 columns on mobile, 3 (tablet) or 4 (desktop) on larger screens.

### 5. Chefs grid

- Already responsive (1 / 3 / 5 columns). No change. Optionally ensure chef cards look good inside the new max-width container.

### 6. Header and tabs

- No structural change. Optional: slightly larger `title` fontSize on desktop (e.g. 28) when `!isMobile`; low priority.
- Tabs and sort already work; they will simply sit inside the max-width container on desktop.

### 7. Floating search

- No change. Already positioned and sized appropriately.

### 8. Pagination

- No change. Remains below the grid; will be inside the max-width wrapper when that is added.

### 9. Testing and polish

- **Desktop/tablet:** Test at 768px, 1024px, 1280px. Confirm content is capped and centered, dishes/cuisines grids show 3–4 columns, chefs grid 3 or 5 columns, no horizontal overflow.
- **Mobile (mandatory before merge):** Test at 375px and 767px. Confirm: header, tabs, sort, dishes 2 columns, chefs 1 column, cuisines 2 columns, floating search. Must match current production.

---

## Suggested implementation order

Each phase: implement only for `!isMobile`; after each phase, confirm mobile is unchanged.

1. **Phase 1 – Content max-width**
   - Add an inner wrapper View around header + tabs + content + pagination that has `maxWidth: 1280`, `width: '100%'`, `alignSelf: 'center'` when `!isMobile`. Mobile: no wrapper or same wrapper without maxWidth so layout is unchanged.
   - **Check:** Mobile layout and padding unchanged.

2. **Phase 2 – Dishes grid columns**
   - Introduce `dishGridColumns = isMobile ? 2 : isTablet ? 3 : 4`. Use it for dish card wrapper width when rendering dishes grid. Keep mobile at 2 columns.
   - **Check:** Mobile still shows 2-column dishes.

3. **Phase 3 – Cuisines grid columns**
   - When `!isMobile`, use `cuisineColumns = isTablet ? 3 : 4` and set cuisine card wrapper width to `${100 / cuisineColumns}%`; when `isMobile` keep `50%`.
   - **Check:** Mobile still shows 2-column cuisines.

4. **Phase 4 – Polish (optional)**
   - Optional: larger header title on desktop. Then test all breakpoints.
   - **Final check:** Full mobile regression.

---

## Files to touch

- **`app/browse/index.tsx`** — Optional `isDesktop`; content wrapper with maxWidth when `!isMobile`; `dishGridColumns` and dish card width; cuisine card wrapper width when `!isMobile`.

No new components required. Reuse existing grid, card wrappers, and styles with conditional values.
