# 🎨 Soft Green Design System - Color Palette

## Primary Brand Colors

### Soft Green (Main Brand Color)

```
HEX: #22C55E
RGB: 34, 197, 94
Tailwind: primary-500
CSS Variable: --primary
Use: Primary buttons, key actions, brand elements, focus rings
```

### Soft Green Scale

```
primary-50   → #F0FDF4  (Very light tint, backgrounds)
primary-100  → #DCFCE7  (Subtle backgrounds, hover states)
primary-200  → #BBF7D0  (Lighter accents)
primary-300  → #86EFAC  (Soft highlights)
primary-400  → #4ADE80  (Accent elements)
primary-500  → #22C55E  (Main brand color ⭐)
primary-600  → #16A34A  (Hover state - primary buttons)
primary-700  → #15803D  (Active/pressed state)
primary-800  → #166534  (Dark mode strong)
primary-900  → #14532D  (Darkest, high contrast)
```

---

## Secondary Accent

### Light Blue

```
HEX: #3B82F6
RGB: 59, 130, 246
Tailwind: blue-500
CSS Variable: --secondary
Use: Secondary buttons, info elements, links
```

### Blue Hover

```
HEX: #2563EB
RGB: 37, 99, 235
Tailwind: blue-600
Use: Hover states for blue elements
```

---

## Neutrals (Gray Scale)

### Light Mode

```
gray-50   → #FAFAFA  (App background, subtle surface)
gray-100  → #F5F5F5  (Section backgrounds)
gray-200  → #E5E5E5  (Subtle borders, dividers)
gray-300  → #D4D4D4  (Input borders default)
gray-400  → #A3A3A3  (Disabled states, placeholders)
gray-500  → #737373  (Secondary text, icons)
gray-600  → #525252  (Body text)
gray-700  → #404040  (Primary text)
gray-800  → #262626  (Headings, emphasis)
gray-900  → #171717  (Maximum contrast, headers)
```

### Dark Mode

```
Background: #0A0A0A (Main dark background)
Card Surface: #171717 (Dark card surface)
Elevated: #262626 (Elevated elements)
Border: #404040 (Dark borders)
```

---

## Status Colors

### Success (Soft Green)

```
Main: #22C55E (primary-500)
Soft Background: #F0FDF4 (primary-50)
Dark Soft: #064E3B (emerald-900)
Use: Success messages, healthy status, positive indicators
```

### Warning (Amber)

```
Main: #F59E0B (amber-500)
Soft Background: #FFFBEB (amber-50)
Dark Soft: #451A03 (amber-950)
Use: Warning messages, needs attention, caution
```

### Error (Red)

```
Main: #EF4444 (red-500)
Soft Background: #FEF2F2 (red-50)
Dark Soft: #4C0519 (rose-950)
Use: Error messages, critical status, destructive actions
```

### Info (Sky Blue)

```
Main: #0EA5E9 (sky-500)
Soft Background: #F0F9FF (sky-50)
Dark Soft: #075985 (sky-900)
Use: Informational messages, help text, notifications
```

---

## Borders & Dividers

### Light Mode

```
Border: #E5E5E5 (gray-200)
Input Border: #D4D4D4 (gray-300)
```

### Dark Mode

```
Border: #404040 (gray-700)
Input Border: #404040 (gray-700)
```

---

## Text Colors

### Light Mode

```
Foreground: #404040 (gray-700) - Primary text
Muted: #737373 (gray-500) - Secondary text
Heading: #262626 (gray-800) - Headlines
```

### Dark Mode

```
Foreground: #FAFAFA (gray-50) - Primary text
Muted: #A3A3A3 (gray-400) - Secondary text
Heading: #FAFAFA (gray-50) - Headlines
```

---

## Chart Colors

```
Chart 1: #3B82F6 (Light Blue)
Chart 2: #22C55E (Soft Green)
Chart 3: #F59E0B (Amber)
Chart 4: #F43F5E (Rose)
Chart 5: #64748B (Slate)
```

---

## Sidebar Colors

### Light Mode

```
Background: #FFFFFF (white)
Foreground: #525252 (gray-600)
Active Accent: #F0FDF4 (primary-50)
Active Foreground: #15803D (primary-700)
```

### Dark Mode

```
Background: #171717 (gray-900)
Foreground: #E2E8F0 (slate-200)
Active Accent: #334155 (slate-700)
Active Foreground: #34D399 (emerald-400)
```

---

## Usage Guidelines

### Primary Actions

- Use **Soft Green** (#22C55E) for main CTAs
- Use **primary-600** (#16A34A) for hover states
- Use **primary-700** (#15803D) for active/pressed states

### Secondary Actions

- Use **Light Blue** (#3B82F6)
- Use outline variant with green border for alternative style

### Destructive Actions

- Always use **Red** (#EF4444)
- Require confirmation dialog
- Use danger button variant

### Status Indicators

- **Healthy/Success:** Soft Green (#22C55E)
- **Warning/Attention:** Amber (#F59E0B)
- **Critical/Error:** Red (#EF4444)
- **Info/Neutral:** Sky Blue (#0EA5E9)

### Backgrounds

- Keep backgrounds subtle (gray-50 in light, #0A0A0A in dark)
- Use pure white for card surfaces in light mode
- Use gray-900 (#171717) for card surfaces in dark mode

---

## Focus States

**Green Focus Ring:**
```css
box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
```

All interactive elements should use the soft green focus ring for consistency.

---

## Tailwind Classes Quick Reference

### Backgrounds

```
bg-primary          // Soft Green (#22C55E)
bg-secondary        // Light Blue (#3B82F6)
bg-sam-success      // Success Green
bg-sam-warning      // Amber
bg-sam-error        // Red
bg-sam-info         // Sky Blue
```

### Text Colors

```
text-primary        // Soft Green
text-secondary      // Light Blue
text-foreground     // Primary text
text-muted-foreground  // Secondary text
```

### Borders

```
border-border       // Subtle border
border-primary      // Soft Green border
```

### Status Badges

```
bg-sam-success text-white       // Success badge
bg-sam-warning text-white       // Warning badge
bg-sam-error text-white         // Error badge
bg-sam-info text-white          // Info badge
```

---

## Shadows

```css
/* Soft shadow for cards */
shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)

/* Medium shadow on hover */
shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)

/* Large shadow for modals */
shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)

/* Green focus ring */
shadow-focus: 0 0 0 3px rgba(34, 197, 94, 0.2)
```

---

## Color Accessibility

All color combinations meet **WCAG 2.1 Level AA** standards:

- ✅ Text colors have sufficient contrast (4.5:1 minimum)
- ✅ Status colors are distinguishable
- ✅ Focus states are clearly visible
- ✅ Dark mode maintains proper contrast
- ✅ Primary green works on white and dark backgrounds

---

## Design Philosophy

This palette embodies:
- **Soft & Elegant:** Not neon or overwhelming
- **Modern & Professional:** Enterprise-grade quality
- **Accessible:** WCAG AA+ compliance
- **Harmonious:** Colors work together naturally
- **Timeless:** Won't feel dated in 2-3 years

---

**Inspiration:** Stripe, Linear, Vercel, Notion  
**Version:** 2.0 (Soft Green System)  
**Last Updated:** 2026-02-11
