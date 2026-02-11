# 🎨 Enterprise Color Palette - Quick Reference

## Primary Brand Colors

### Light Emerald Green (Main Color)

```
HEX: #059669
RGB: 5, 150, 105
Tailwind: emerald-600
CSS Variable: --primary
Use: Primary buttons, key actions, brand elements
```

### Emerald Accent

```
HEX: #10B981
RGB: 16, 185, 129
Tailwind: emerald-500
CSS Variable: --sam-success / --ring
Use: Success states, accents, highlights, focus rings
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

## Backgrounds

### Light Mode

```
Background: #F8FAFC (slate-50)
Card Surface: #FFFFFF (white)
Muted: #F1F5F9 (slate-100)
```

### Dark Mode

```
Background: #0F172A (slate-900)
Card Surface: #1E293B (slate-800)
Muted: #1E293B (slate-800)
```

---

## Status Colors

### Success (Emerald)

```
Main: #10B981 (emerald-500)
Soft Background: #D1FAE5 (emerald-100)
Dark Soft: #064E3B (emerald-900)
Use: Success messages, healthy status, positive indicators
```

### Warning (Amber)

```
Main: #F59E0B (amber-500)
Soft Background: #FEF3C7 (amber-100)
Dark Soft: #451A03 (amber-950)
Use: Warning messages, needs attention, caution
```

### Danger/Error (Rose)

```
Main: #F43F5E (rose-500)
Soft Background: #FFE4E6 (rose-100)
Dark Soft: #4C0519 (rose-950)
Use: Error messages, critical status, destructive actions
```

### Info (Sky)

```
Main: #0EA5E9 (sky-500)
Soft Background: #E0F2FE (sky-100)
Dark Soft: #075985 (sky-900)
Use: Informational messages, help text, notifications
```

---

## Borders & Dividers

### Light Mode

```
Border: #E2E8F0 (slate-200)
Input Border: #E2E8F0 (slate-200)
```

### Dark Mode

```
Border: #334155 (slate-700)
Input Border: #334155 (slate-700)
```

---

## Text Colors

### Light Mode

```
Foreground: #0F172A (slate-900)
Muted: #64748B (slate-500)
```

### Dark Mode

```
Foreground: #F1F5F9 (slate-100)
Muted: #94A3B8 (slate-400)
```

---

## Chart Colors

```
Chart 1: #3B82F6 (Light Blue)
Chart 2: #10B981 (Emerald)
Chart 3: #F59E0B (Amber)
Chart 4: #F43F5E (Rose)
Chart 5: #64748B (Slate)
```

---

## Sidebar Colors

### Light Mode

```
Background: #FFFFFF (white)
Foreground: #334155 (slate-700)
Active Accent: #F0FDF4 (green-50)
Active Foreground: #059669 (Light Green)
```

### Dark Mode

```
Background: #1E293B (slate-800)
Foreground: #E2E8F0 (slate-200)
Active Accent: #334155 (slate-700)
Active Foreground: #10B981 (Emerald)
```

---

## Usage Guidelines

### Primary Actions

- Use **Light Emerald Green** (#059669) for main CTAs
- Use **Emerald** (#10B981) for success confirmations

### Secondary Actions

- Use **Light Blue** (#3B82F6)
- Use outline variant with green border

### Destructive Actions

- Always use **Rose** (#F43F5E)
- Require confirmation dialog

### Status Indicators

- **Healthy/Success:** Emerald (#10B981)
- **Warning/Attention:** Amber (#F59E0B)
- **Critical/Error:** Rose (#F43F5E)
- **Info/Neutral:** Sky (#0EA5E9)

### Backgrounds

- Keep backgrounds subtle (slate-50 in light, slate-900 in dark)
- Use pure white for card surfaces in light mode
- Use slate-800 for card surfaces in dark mode

---

## Tailwind Classes Quick Reference

### Backgrounds

```
bg-primary          // Light Emerald Green
bg-secondary        // Light Blue
bg-sam-success      // Emerald
bg-sam-warning      // Amber
bg-sam-error        // Rose
bg-sam-info         // Sky
```

### Text Colors

```
text-primary        // Light Emerald Green
text-secondary      // Light Blue
text-muted-foreground  // Slate-500 (light) / Slate-400 (dark)
```

### Borders

```
border-border       // Slate-200 (light) / Slate-700 (dark)
border-primary      // Light Emerald Green
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
shadow-sm

/* Medium shadow on hover */
shadow-md

/* Custom SAM shadow */
.sam-shadow
```

---

## Examples

### Primary Button

```tsx
<Button variant="default">// Light Emerald Green background, white text</Button>
```

### Secondary Button

```tsx
<Button variant="secondary">// Light Blue background, white text</Button>
```

### Success Badge

```tsx
<Badge className="bg-sam-success text-white">Online</Badge>
```

### Danger Button

```tsx
<Button variant="danger">// Rose background, white text</Button>
```

### Outline Button

```tsx
<Button variant="outline">// Transparent with green border</Button>
```

---

## Color Accessibility

All color combinations meet **WCAG 2.1 Level AA** standards:

- ✅ Text colors have sufficient contrast
- ✅ Status colors are distinguishable
- ✅ Focus states are visible
- ✅ Dark mode maintains proper contrast

---

_Use this palette consistently across all UI components for a professional, enterprise-grade look._
