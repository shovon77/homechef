# Design System Migration Notes

## Overview

This document describes the new design system implementation based on design mockups in `/design/stitch_homechef_hub_homepage/`. The migration maintains all existing functionality while updating visual styling to match the design system.

## Theme System

### Location
- **New theme**: `lib/theme.ts`
- **Old theme**: `constants/theme.ts` (deprecated, kept for backward compatibility)

### Key Changes

1. **Color Palette**:
   - Primary: `#19e680` (bright green)
   - Background: `#112119` (dark green)
   - Surface: `#1C2A23` (dark surface for cards)
   - Text: `#F5F5F5` (light), `#98A2B3` (muted)

2. **Design Tokens**:
   - Spacing: `xs` (4px) to `4xl` (40px)
   - Radius: `sm` (4px) to `full` (9999px)
   - Typography: Plus Jakarta Sans font family
   - Shadows: Platform-aware (iOS/Android/Web)

3. **Utility Helpers**:
   - `cardStyle(elevated)` - Card styling helper
   - `panelStyle()` - Panel styling helper
   - `elev(level)` - Shadow elevation helper
   - `textStyle(variant)` - Typography helper

## Component Structure

### UI Atoms (`components/ui/`)

Reusable design system components:

- **Button** (`components/ui/Button.tsx`)
  - Variants: `primary`, `secondary`, `outline`, `ghost`
  - Sizes: `sm`, `md`, `lg`
  - Features: loading state, disabled state, full width

- **Card** (`components/ui/Card.tsx`)
  - Variants: `default`, `elevated`, `outlined`
  - Configurable padding

- **Input** (`components/ui/Input.tsx`)
  - Label support
  - Error state
  - Focus states (web-compatible)

- **Badge** (`components/ui/Badge.tsx`)
  - Variants: `primary`, `success`, `warning`, `error`, `default`
  - Sizes: `sm`, `md`

- **Stars** (`components/ui/Stars.tsx`)
  - Read-only and editable variants
  - Configurable size and color

- **PageHeader** (`components/ui/PageHeader.tsx`)
  - Title + optional subtitle + actions layout

### Updated Components

- **Tabs** (`components/Tabs.tsx`)
  - Now uses underline style matching design mockups
  - Active tab indicator with primary color

- **Screen** (`components/Screen.tsx`)
  - Updated to use `lib/theme`
  - Consistent background color

- **NavBar** (`components/NavBar.tsx`)
  - Updated to use new theme
  - Maintains all role-aware logic

- **DishCard** (`app/components/DishCard.tsx`)
  - Uses new Card and Stars components
  - Updated styling to match design system

- **ChefCard** (`app/components/ChefCard.tsx`)
  - Uses new Card and Stars components
  - Updated styling to match design system

## Migration Guide

### For New Components

1. Import theme from `lib/theme`:
   ```typescript
   import { theme, cardStyle, elev } from '../lib/theme';
   ```

2. Use UI atoms when possible:
   ```typescript
   import { Button } from '../components/ui/Button';
   import { Card } from '../components/ui/Card';
   ```

3. Use utility helpers:
   ```typescript
   const cardStyles = cardStyle(true); // elevated card
   const shadow = elev('lg');
   ```

### For Existing Components

1. Update theme import:
   ```typescript
   // Old
   import { theme } from '../constants/theme';
   
   // New
   import { theme } from '../lib/theme';
   ```

2. Update color references:
   - `theme.colors.white` → `theme.colors.text` (for text)
   - `theme.colors.textMuted` → `theme.colors.subtle`
   - `theme.colors.surfaceAlt` → `theme.colors.surfaceAlt` (unchanged)

3. Use spacing tokens:
   ```typescript
   // Old
   padding: 12
   
   // New
   padding: theme.spacing.md
   ```

4. Use radius tokens:
   ```typescript
   // Old
   borderRadius: 8
   
   // New
   borderRadius: theme.radius.md
   ```

## Page Updates

All pages should:
1. Use `<Screen>` wrapper for consistent background
2. Use UI atoms (Button, Card, Input, etc.) where applicable
3. Maintain existing functionality (no logic changes)
4. Ensure scrolling works (no `overflow: 'hidden'` on full-page containers)

## Accessibility

- Touch targets: Minimum 44px height (WCAG AA)
- Text contrast: ≥ 4.5:1 for normal text
- Focus states: Visible on web
- Semantic HTML: Proper accessibility roles

## Testing Checklist

- [ ] All pages load without errors
- [ ] Scrolling works on all pages (web, iOS, Android)
- [ ] Auth flow unchanged
- [ ] Role-based routing unchanged
- [ ] Cart functionality unchanged
- [ ] Single-chef cart constraint unchanged
- [ ] Rating submission unchanged
- [ ] Profile persistence unchanged
- [ ] Admin gating unchanged
- [ ] No route collisions

## Design Mockups Reference

All design mockups are in `/design/stitch_homechef_hub_homepage/`:
- Homepage variations
- Dish detail page
- Chef profile page
- Sign in/up pages
- User profile page

Refer to these for visual reference when implementing new features.

## Notes

- **No breaking changes**: All existing functionality preserved
- **Style-only updates**: No data or routing changes
- **Backward compatible**: Old theme file kept for compatibility
- **Minimal diffs**: Style-first edits, minimal code changes

