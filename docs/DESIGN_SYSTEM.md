# HomeChef Design System

This design system is based on the mockups in `/design` directory.

## Color Palette

### Primary Colors
- **Primary**: `#19e680` - Bright green (main brand color)
- **Background**: `#112119` - Dark green (dark mode default)
- **Background Light**: `#f6f8f7` - Very light gray-green (light mode)

### Surface Colors
- **Surface**: `#1C2A23` - Dark surface for cards/panels (dark mode)
- **Surface Light**: `#FFFFFF` - White surface (light mode)
- **Surface Alt**: `rgba(25, 230, 128, 0.1)` - Primary with opacity for subtle backgrounds

### Text Colors
- **Text**: `#F5F5F5` - Light text (dark mode)
- **Text Light**: `#101828` - Dark text (light mode)
- **Text Muted**: `#98A2B3` - Muted text (dark mode)
- **Text Muted Light**: `#667085` - Muted text (light mode)

### Border Colors
- **Border**: `#344054` - Dark border
- **Border Light**: `#EAECF0` - Light border

### Semantic Colors
- **Success**: `#19e680` (same as primary)
- **Warning**: `#ffb700` (yellow/gold)
- **Error**: `#ef4444` (red)
- **Info**: `#0ea5e9` (blue)

## Typography

### Font Family
- **Display**: `Plus Jakarta Sans, Noto Sans, sans-serif`
- **Body**: `Plus Jakarta Sans, system-ui, sans-serif`

### Font Sizes
- xs: 12px
- sm: 14px
- base: 16px
- lg: 18px
- xl: 20px
- 2xl: 22px
- 3xl: 24px
- 4xl: 28px
- 5xl: 32px

### Font Weights
- normal: 400
- medium: 500
- semibold: 600
- bold: 700
- extrabold: 800
- black: 900

### Letter Spacing
- tight: -0.033em (for large headings)
- normal: -0.015em (for body text)
- wide: 0.015em (for buttons)

## Spacing

- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 20px
- 2xl: 24px
- 3xl: 32px
- 4xl: 40px

## Border Radius

- sm: 4px
- md: 8px
- lg: 12px
- xl: 16px
- 2xl: 20px
- full: 9999px (for circular elements)

## Components

### Button
Located in `components/Button.tsx`

Variants:
- `primary` - Primary action button (bright green background)
- `secondary` - Secondary action (subtle background)
- `outline` - Outlined button (transparent with border)
- `ghost` - Ghost button (transparent, no border)

Sizes:
- `sm` - Small (8px vertical padding)
- `md` - Medium (12px vertical padding) - default
- `lg` - Large (14px vertical padding)

### Card
Located in `components/Card.tsx`

Variants:
- `default` - Standard card with border
- `elevated` - Card with shadow
- `outlined` - Transparent card with border only

### Input
Located in `components/Input.tsx`

Features:
- Label support
- Error state
- Consistent styling matching design system

### Screen
Located in `components/Screen.tsx`

Wrapper component for pages that provides:
- SafeAreaView with flex: 1
- Optional ScrollView wrapper
- Consistent background color

## Usage

```typescript
import { theme } from '../constants/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';

// Using theme colors
<View style={{ backgroundColor: theme.colors.surface }}>
  <Text style={{ color: theme.colors.text }}>
    Hello World
  </Text>
</View>

// Using components
<Button 
  title="Sign Up" 
  variant="primary" 
  size="lg"
  onPress={() => {}}
/>

<Card variant="elevated" padding="lg">
  <Text>Card content</Text>
</Card>

<Input 
  label="Email" 
  placeholder="you@example.com"
/>
```

## Design Mockups Reference

All design mockups are located in `/design/stitch_homechef_hub_homepage/`:
- Homepage variations
- Dish detail page
- Chef profile page
- Sign in/up pages
- User profile page

Refer to these mockups for visual reference when implementing new features.

