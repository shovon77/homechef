# Homepage desktop/tablet improvement plan

The homepage (`app/index.tsx`) is tuned for mobile; desktop and tablet get the same “non-mobile” layout with no max-width or grid adaptations. This plan aligns the page with the rest of the app (navbar, cart, browse) and improves readability and use of space on larger screens.

---

## Critical: preserve mobile experience

**The mobile view is final and must not be broken or changed.**

- All improvements in this plan apply **only when `!isMobile`** (i.e. viewport width ≥ 768px). Mobile (width < 768) keeps the **exact** current layout, styles, and behavior.
- Implementation rule: use conditional styles and layout branches (e.g. `isMobile ? ... : ...` or `!isMobile && ...`). Never replace mobile behavior; only add desktop/tablet variants.
- Before merging any change: verify the homepage on a narrow viewport (e.g. 375px) and at 767px — hero, featured dishes (horizontal scroll + auto-scroll), chefs horizontal scroll, How it works (single column), floating search, and CTA must look and behave exactly as they do today.

---

## Current state (summary)

- **Breakpoint:** Single `isMobile = width < 768`. No tablet (768–1024) or desktop-specific layout.
- **Container:** `styles.container` uses `width: "100%", maxWidth: "100%"` — content spans full viewport. No cap like NavBar (1280px) or cart (1280px).
- **Hero:** Full width, aspect ratio 3 on web. No max-width or max-height; on ultra-wide it becomes very wide and tall.
- **Featured dishes:** Horizontal `ScrollView` only. Card width 200 (mobile) / 240 (desktop). No grid on desktop; one long horizontal strip.
- **Popular near you (chefs):** Same — horizontal scroll only. Chef cards 360 (mobile) / 420 (desktop). No multi-column or grid on large screens.
- **How it works:** `howItWorksGrid` is always a **column** (vertical stack). No row layout on tablet/desktop; three cards stay in a single column.
- **Floating search:** Already has `maxWidth: 580` on web — fine.
- **Padding:** `paddingHorizontal: theme.spacing.md` (12px) for all breakpoints; on large screens content touches edges visually.

---

## Goals

1. **Consistent content width** with navbar/cart (e.g. max-width ~1280px, centered).
2. **Better use of space** on tablet (768–1024) and desktop (≥1024): grids where appropriate, optional row layout for “How it works.”
3. **Controlled hero** on large screens (max-width and/or max-height so it doesn’t dominate or stretch oddly).
4. **Clear breakpoints** (mobile / tablet / desktop) so future tweaks are easy.

---

## Plan (concrete steps)

### 1. Breakpoints and shared constants

- In `app/index.tsx` (or a small layout helper), define:
  - `isMobile = width < 768`
  - `isTablet = width >= 768 && width < 1024`
  - `isDesktop = width >= 1024`
- Optionally add a shared constant for content max-width (e.g. `CONTENT_MAX_WIDTH = 1280`) so it matches NavBar/cart if desired.

### 2. Main container (content width + padding)

- **Mobile:** Do not change. Keep existing `styles.container` and `styles.containerMobile` as-is when `isMobile`. Apply max-width and extra padding only when `!isMobile`.
- **Desktop/tablet only:** When `!isMobile`, apply (e.g. via a new style or condition):
  - `maxWidth: 1280` (or `CONTENT_MAX_WIDTH`).
  - `alignSelf: 'center'` (already there).
  - Slightly larger horizontal padding on desktop/tablet (e.g. `paddingHorizontal: theme.spacing.xl` or 24 when `width >= 768`) so content doesn’t hug the edges on 1280px-wide content.

### 3. Hero section

- **Mobile:** No changes. Keep existing `styles.hero` / `styles.heroMobile` and hero image styles exactly as they are.
- **Desktop/tablet only:** When `!isMobile`:
  - Constrain width: e.g. hero wrapper respects the same `maxWidth` as the main container (or 100% of that container), so it doesn’t exceed 1280px when container is capped.
  - Optionally cap height on very tall viewports (e.g. `maxHeight: 420` or aspect ratio cap) so the hero doesn’t dominate; keep aspect ratio where possible.

### 4. Featured dishes (“Featured this week”)

- **Mobile:** Do not change. Keep the current horizontal `ScrollView`, auto-scroll logic, `CARD_WIDTH` (200), `CircularDishCard`, and all related refs/callbacks exactly as-is. Any new layout (e.g. grid) must be rendered only when `!isMobile`.
- **Tablet/desktop:** Choose one (or A then B):
  - **A (minimal):** Keep horizontal scroll but ensure the scroll strip is visually contained (e.g. same max-width as container, padding so it doesn’t run edge-to-edge).
  - **B (better use of space):** On tablet/desktop, show a **grid** of circular dish cards (e.g. 2–3 columns on tablet, 3–4 on desktop) with `flexWrap`, and optionally keep a smaller horizontal strip as “featured” or a “View all” link. This may require a second layout branch (grid vs horizontal ScrollView) based on `isTablet || isDesktop`.

### 5. Popular near you (chefs)

- **Mobile:** Do not change. Keep the current horizontal `ScrollView`, `homepageChefCardWrapper` (360), and `ChefCard` usage exactly as-is. Grid layout, if added, must be used only when `!isMobile`.
- **Tablet/desktop:**
  - **Option A:** Same max-width as container; horizontal scroll but contained.
  - **Option B (recommended):** Grid layout: e.g. 2 columns (tablet) and 2–3 columns (desktop), `flexWrap`, same card component. Aligns with browse page which uses a grid for chefs.

### 6. How it works

- **Mobile:** Do not change. Keep `howItWorksGrid` as column and `howItWorksGridMobile` as-is. Row layout must be applied only when `!isMobile` (e.g. `flexDirection: isMobile ? 'column' : 'row'` on the grid container; do not remove the mobile column behavior).
- **Tablet/desktop only:** Use a **row** of three cards (Discover, Order, Pickup). Reuse existing `howItWorksCard` styles; set grid to `flexDirection: 'row'` and give each card `flex: 1` with gap only when `!isMobile`.

### 7. “Become a Chef” CTA

- Already centered. Optionally give the CTA block a `maxWidth` for readability on very wide screens; low priority.

### 8. Section titles and typography

- On desktop/tablet, section titles can stay as-is or get a slight size increase (e.g. same as current web 30px or a bit larger). Optional: constrain line length (e.g. `maxWidth` on the title container) for long lines on ultra-wide.

### 9. Floating search bar

- No change needed; already `maxWidth: 580` and centered on web.

### 10. Testing and polish

- **Desktop/tablet:** Test at 768px, 1024px, 1280px, and 1920px.
- Ensure horizontal scrolls (if kept on any section) don’t overflow the constrained container (no full-viewport-wide scroll strip when content is capped at 1280px).
- **Mobile (mandatory before merge):** Test at 375px and 767px. Confirm nothing changed: hero, featured dishes (horizontal scroll + auto-scroll, 200px cards), popular near you (horizontal scroll, 360px cards), How it works (single column), floating search bar, Become a Chef CTA. Overall scroll and padding must match current production.

---

## Suggested implementation order

Each phase: implement only for `!isMobile`; after each phase, confirm mobile at 375px and 767px is unchanged.

1. **Phase 1 – Layout and container**
   - Add `isTablet` / `isDesktop` (and optional `CONTENT_MAX_WIDTH`).
   - Apply `maxWidth` + centered container + padding for desktop/tablet.
   - Constrain hero width/height for desktop/tablet only.
   - **Check:** Mobile layout and padding unchanged.

2. **Phase 2 – How it works**
   - Switch “How it works” to row of 3 cards only when `!isMobile` (quick win, no new components).
   - **Check:** Mobile still shows single column.

3. **Phase 3 – Chefs section**
   - Add grid layout for “Popular near you” only when `!isMobile` (reuse existing `ChefCard` and wrapper styles).
   - **Check:** Mobile still shows horizontal scroll, 360px cards.

4. **Phase 4 – Featured dishes (optional)**
   - Either keep horizontal scroll but contained on desktop, or add a grid variant only when `!isMobile`.
   - **Check:** Mobile keeps horizontal scroll, auto-scroll, 200px cards.

5. **Phase 5 – Polish**
   - Typography/spacing tweaks for desktop/tablet only, then test all breakpoints.
   - **Final check:** Full mobile regression (hero, dishes, chefs, How it works, search, CTA).

---

## Files to touch

- **`app/index.tsx`** — All layout and style changes (breakpoints, container, hero, sections, How it works, chefs grid, optional dishes grid).
- **`lib/theme.ts`** or **`constants/layout.ts`** (optional) — Add `CONTENT_MAX_WIDTH` or breakpoint numbers if you want them shared with NavBar/cart.

No new components are strictly required; the plan uses existing `ChefCard`, `CircularDishCard`, and section structure with conditional styles and layout (row vs column, scroll vs grid).
