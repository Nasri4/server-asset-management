# 🎨 Figma-Style Component Design System
## World-Class SaaS Dashboard — Stripe + Linear + Vercel Quality

**Primary Brand Color:** Soft Green (Elegant, Modern, Premium)  
**Design Philosophy:** Minimal • Elegant • Consistent • Timeless

---

## 1. DESIGN TOKENS (FOUNDATION LAYER)

### A) Color Tokens

#### Primary (Soft Green System)
Modern, elegant green palette — not neon, not forest green. Think: Sustainable tech, growth, health.

```
primary-50   → #F0FDF4  (Very light tint, backgrounds)
primary-100  → #DCFCE7  (Subtle backgrounds, hover states)
primary-200  → #BBF7D0  (Lighter accents)
primary-300  → #86EFAC  (Soft highlights)
primary-400  → #4ADE80  (Accent elements)
primary-500  → #22C55E  (Main brand color - Soft Green)
primary-600  → #16A34A  (Hover state - primary buttons)
primary-700  → #15803D  (Active/pressed state)
primary-800  → #166534  (Dark mode strong)
primary-900  → #14532D  (Darkest, high contrast)
```

**Usage:**
- `primary-500` → Primary buttons, key CTAs, brand elements
- `primary-600` → Hover states for primary actions
- `primary-700` → Active/pressed states
- `primary-50/100` → Subtle backgrounds, success messages
- `primary-900` → Dark mode text on green backgrounds

---

#### Neutrals (Sophisticated Gray Scale)
Balanced grayscale for enterprise SaaS — neither too warm nor too cool.

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

**Usage:**
- `gray-50` → Main app background
- `gray-100` → Card/section backgrounds
- `gray-200` → Borders, dividers
- `gray-500` → Secondary text, muted elements
- `gray-700/800` → Primary text content
- `gray-900` → Headlines, emphasis

---

#### Semantic Colors
Status and feedback colors that work harmoniously with soft green brand.

**Success (Aligned with Primary Green)**
```
success-50   → #F0FDF4  (Same as primary-50)
success-500  → #22C55E  (Same as primary-500)
success-600  → #16A34A  (Confirmation messages)
success-700  → #15803D  (Strong success emphasis)
```

**Warning (Warm Amber)**
```
warning-50   → #FFFBEB
warning-500  → #F59E0B  (Amber - needs attention)
warning-600  → #D97706  (Hover state)
warning-700  → #B45309  (Active state)
```

**Error (Rose/Red)**
```
error-50   → #FEF2F2
error-500  → #EF4444  (Destructive actions, errors)
error-600  → #DC2626  (Hover state)
error-700  → #B91C1C  (Active state)
```

**Info (Sky Blue)**
```
info-50   → #F0F9FF
info-500  → #0EA5E9  (Informational, neutral highlights)
info-600  → #0284C7  (Hover state)
info-700  → #0369A1  (Active state)
```

---

### B) Typography Tokens

**Font Family:** Inter (Primary), SF Pro (Fallback), System UI

#### Type Scale

**H1 — Page Title**
```
font-size: 32px (2rem)
line-height: 40px (1.25)
font-weight: 700 (Bold)
letter-spacing: -0.02em (Tight)
color: gray-900
```
*Use for: Main page headlines*

**H2 — Section Title**
```
font-size: 24px (1.5rem)
line-height: 32px (1.33)
font-weight: 600 (SemiBold)
letter-spacing: -0.01em
color: gray-800
```
*Use for: Major section headers*

**H3 — Subsection**
```
font-size: 18px (1.125rem)
line-height: 28px (1.55)
font-weight: 600 (SemiBold)
letter-spacing: -0.01em
color: gray-800
```
*Use for: Card titles, subsection headers*

**Body Large**
```
font-size: 16px (1rem)
line-height: 24px (1.5)
font-weight: 400 (Regular)
letter-spacing: 0
color: gray-700
```
*Use for: Important body text, descriptions*

**Body — Default**
```
font-size: 14px (0.875rem)
line-height: 20px (1.43)
font-weight: 400 (Regular)
letter-spacing: 0
color: gray-600
```
*Use for: Standard body text, table content*

**Caption**
```
font-size: 12px (0.75rem)
line-height: 16px (1.33)
font-weight: 400 (Regular)
letter-spacing: 0
color: gray-500
```
*Use for: Helper text, metadata, timestamps*

**Label**
```
font-size: 12px (0.75rem)
line-height: 16px (1.33)
font-weight: 500 (Medium)
letter-spacing: 0.02em (Wide)
text-transform: uppercase
color: gray-700
```
*Use for: Form labels, section labels*

---

### C) Spacing System
Strict 8px base scale for consistency and rhythm.

```
4px   → 0.25rem  (xs)   → Tight internal spacing
8px   → 0.5rem   (sm)   → Component padding
12px  → 0.75rem  (md)   → Small gaps
16px  → 1rem     (base) → Standard spacing
24px  → 1.5rem   (lg)   → Section spacing
32px  → 2rem     (xl)   → Large gaps
40px  → 2.5rem   (2xl)  → Component margins
48px  → 3rem     (3xl)  → Major sections
64px  → 4rem     (4xl)  → Page sections
```

**Component Internal Padding:**
- Small buttons: 8px vertical, 12px horizontal
- Medium buttons: 10px vertical, 16px horizontal
- Large buttons: 12px vertical, 24px horizontal
- Inputs: 10px vertical, 12px horizontal
- Cards: 24px all sides
- Modals: 32px all sides

**Layout Spacing:**
- Between cards: 16px
- Between sections: 32px
- Page padding: 24px (mobile), 40px (desktop)

---

### D) Border Radius

```
sm   → 4px   (0.25rem)  → Small elements, badges
md   → 6px   (0.375rem) → Buttons, inputs
lg   → 8px   (0.5rem)   → Cards, dropdowns
xl   → 12px  (0.75rem)  → Modals, large cards
2xl  → 16px  (1rem)     → Hero sections
```

**Component Recommendations:**
- Buttons: `md` (6px)
- Inputs: `md` (6px)
- Cards: `lg` (8px)
- Modals: `xl` (12px)
- Badges: `sm` or `full` (rounded-full)

---

### E) Shadow Levels

Soft, subtle shadows that add depth without drama.

**shadow-sm (Subtle)**
```css
box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
```
*Use for: Cards at rest, slight elevation*

**shadow-md (Default)**
```css
box-shadow: 
  0 4px 6px -1px rgba(0, 0, 0, 0.1),
  0 2px 4px -1px rgba(0, 0, 0, 0.06);
```
*Use for: Dropdowns, popovers, floating elements*

**shadow-lg (Elevated)**
```css
box-shadow: 
  0 10px 15px -3px rgba(0, 0, 0, 0.1),
  0 4px 6px -2px rgba(0, 0, 0, 0.05);
```
*Use for: Modals, important overlays*

**shadow-focus (Green Focus Ring)**
```css
box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
/* primary-500 at 20% opacity */
```
*Use for: Focus states on inputs, buttons*

---

## 2. CORE COMPONENTS (REUSABLE)

### Buttons

Premium button system with proper states and variants.

#### Button Variants

**Primary Button**
```
Background: primary-500 (#22C55E)
Text: white
Border: none
Hover: primary-600 (#16A34A)
Active: primary-700 (#15803D)
Disabled: gray-300 bg, gray-400 text
Loading: Spinner + primary-600 bg
```

**Secondary Button (Outline)**
```
Background: transparent
Text: primary-600
Border: 1px solid primary-500
Hover: primary-50 bg, border primary-600
Active: primary-100 bg
Disabled: gray-300 border, gray-400 text
```

**Ghost Button**
```
Background: transparent
Text: gray-700
Border: none
Hover: gray-100 bg
Active: gray-200 bg
Disabled: gray-400 text
```

**Destructive Button**
```
Background: error-500 (#EF4444)
Text: white
Border: none
Hover: error-600 (#DC2626)
Active: error-700 (#B91C1C)
Disabled: gray-300 bg, gray-400 text
```

**Icon Button**
```
Size: 40x40px (square)
Background: transparent
Hover: gray-100 bg
Active: gray-200 bg
Icon: 20x20px, gray-600
```

#### Button States

All buttons share these state behaviors:

**Default**
- Clean, minimal appearance
- Subtle shadow-sm (optional)

**Hover**
- Background color darkens slightly
- Smooth 150ms transition
- Optional: subtle scale (1.01)
- Cursor: pointer

**Active (Pressed)**
- Background darkens further
- Optional: slight scale (0.98)
- Immediate response (50ms)

**Disabled**
- Opacity: 0.5
- Cursor: not-allowed
- No hover effects

**Loading**
- Spinner icon (16px)
- Text: "Loading..." or keep original
- Disabled interaction
- Pulsing animation

---

### Inputs

Clean, accessible form inputs with clear states.

#### Input Variants

**Text Input**
```
Height: 40px
Padding: 10px 12px
Border: 1px solid gray-300
Border-radius: md (6px)
Background: white
Font: Body (14px)
```

**Password Input**
```
Same as text input
+ Toggle visibility icon (right aligned)
Icon: Eye/EyeOff (20px, gray-500)
```

**Select Dropdown**
```
Same as text input
+ Chevron down icon (right aligned)
Icon: 16px, gray-500
Dropdown: shadow-md, rounded-lg
```

**Textarea**
```
Min-height: 80px
Padding: 12px
Border: 1px solid gray-300
Border-radius: md (6px)
Resize: vertical
```

**Toggle Switch**
```
Width: 44px
Height: 24px
Background (off): gray-300
Background (on): primary-500
Circle: white, 18px
Transition: 200ms ease
```

**Checkbox**
```
Size: 20x20px
Border: 2px solid gray-300
Border-radius: sm (4px)
Checked: primary-500 bg, white checkmark
```

**Radio Button**
```
Size: 20x20px
Border: 2px solid gray-300
Border-radius: full
Selected: primary-500 border, inner dot 8px
```

#### Input States

**Default**
```
Border: gray-300
Background: white
Text: gray-700
Placeholder: gray-400
```

**Hover**
```
Border: gray-400
Smooth transition (150ms)
```

**Focus**
```
Border: primary-500
Shadow: shadow-focus (green ring)
Outline: none
```

**Error**
```
Border: error-500
Shadow: 0 0 0 3px error-500/20
Helper text: error-600, caption size
Icon: AlertCircle (red)
```

**Disabled**
```
Background: gray-100
Border: gray-200
Text: gray-400
Cursor: not-allowed
```

---

### Cards

Clean, minimal containers for content grouping.

**Standard Card**
```
Background: white
Border: 1px solid gray-200
Border-radius: lg (8px)
Padding: 24px
Shadow: shadow-sm
```

**Elevated Card**
```
Same as standard
Shadow: shadow-md
Hover: shadow-lg (optional)
```

**Section Container**
```
Background: gray-50
Border: none
Border-radius: lg (8px)
Padding: 32px
```

---

### Tables

Enterprise-grade data tables with professional styling.

**Table Header**
```
Background: gray-50
Text: gray-700, 12px, 500 weight, uppercase
Padding: 12px 16px
Border-bottom: 2px solid gray-200
Sticky: yes (top: 0)
```

**Table Row**
```
Background: white
Border-bottom: 1px solid gray-200
Padding: 12px 16px
Hover: gray-50 bg
```

**Status Badge (in table)**
```
Small pill shape
Padding: 4px 8px
Font: 12px, 500 weight
Border-radius: full
Success: primary-100 bg, primary-700 text
Warning: warning-100 bg, warning-700 text
Error: error-100 bg, error-700 text
```

**Inline Actions Dropdown**
```
Icon button (3 dots vertical)
Size: 32x32px
Hover: gray-100 bg
Dropdown: shadow-lg, rounded-md
```

**Pagination**
```
Container: flex, justify-between
Page numbers: ghost buttons
Current: primary-500 bg, white text
Previous/Next: outline style
```

---

### Navigation

**Sidebar Item**
```
Height: 40px
Padding: 8px 12px
Border-radius: md (6px)
Icon: 20x20px (left aligned)
Text: 14px, 500 weight
Gap: 8px

Default: gray-700 text, transparent bg
Hover: gray-100 bg
Active: primary-50 bg, primary-600 text, primary icon
```

**Topbar**
```
Height: 64px
Background: white
Border-bottom: 1px solid gray-200
Padding: 0 24px
Shadow: shadow-sm
```

**Breadcrumb**
```
Separator: Chevron right (16px, gray-400)
Links: gray-600, hover: gray-900
Current: gray-900, 600 weight
Font: 14px
```

---

### Dialogs (Modals)

**Standard Modal**
```
Width: 480px (default), 640px (medium), 800px (large)
Background: white
Border-radius: xl (12px)
Padding: 32px
Shadow: shadow-lg
Backdrop: rgba(0, 0, 0, 0.5), blur(4px)

Header: H3 typography
Content: Body text
Footer: Buttons (right aligned)
Close icon: top-right (32px, gray-500)
```

**Confirmation Modal**
```
Same as standard
Icon: Info circle (info-500, 48px)
Title: centered
Actions: Primary + Ghost buttons
```

**Danger Modal (Destructive)**
```
Same as standard
Icon: AlertTriangle (error-500, 48px)
Title: centered
Primary action: Destructive button
Secondary: Ghost button
Requires confirmation text input (optional)
```

---

### Badges

Small labels for status, roles, and categories.

**Default Badge**
```
Padding: 4px 8px
Border-radius: full
Font: 12px, 500 weight
Background: gray-100
Text: gray-700
```

**Success Badge**
```
Background: primary-100
Text: primary-700
```

**Warning Badge**
```
Background: warning-100
Text: warning-700
```

**Error Badge**
```
Background: error-100
Text: error-700
```

**Info Badge**
```
Background: info-100
Text: info-700
```

**Role Badges**
```
Admin: error-100 bg, error-700 text
TeamLead: info-100 bg, info-700 text
Engineer: primary-100 bg, primary-700 text
```

---

## 3. LAYOUT SYSTEM

### Dashboard Shell

**Structure:**
```
┌─────────────────────────────────────┐
│ Sidebar   │   Topbar               │
│           ├────────────────────────┤
│           │                        │
│           │   Content Wrapper      │
│           │                        │
│           │                        │
└───────────┴────────────────────────┘
```

**Sidebar**
```
Width: 240px (expanded), 64px (collapsed)
Background: white
Border-right: 1px solid gray-200
Padding: 16px
Z-index: 10
```

**Topbar**
```
Height: 64px
Position: sticky top
Background: white
Border-bottom: 1px solid gray-200
Padding: 0 24px
Z-index: 20
```

**Content Wrapper**
```
Max-width: 1280px (desktop)
Padding: 40px
Margin: 0 auto
Background: gray-50
```

---

### Page Header

Professional page header with clear hierarchy.

```
┌─────────────────────────────────────┐
│ Title                    [Actions] │
│ Description                        │
└─────────────────────────────────────┘

Title: H1 typography
Description: Body large, gray-600
Primary Action: Primary button
Secondary Actions: Ghost/outline buttons
Spacing: 24px below header
```

---

### Section Header

```
┌─────────────────────────────────────┐
│ Title              [Optional Action]│
│ ────────────────────────────────────│
└─────────────────────────────────────┘

Title: H3 typography
Optional actions: Icon buttons or ghost buttons
Divider: 1px solid gray-200
Margin: 32px top, 16px bottom
```

---

### Empty State

Friendly empty states for better UX.

```
┌─────────────────────────────────────┐
│                                     │
│         [Illustration 96x96]        │
│                                     │
│         No Items Found              │
│    You haven't created any items    │
│              yet.                   │
│                                     │
│         [Create Item CTA]           │
│                                     │
└─────────────────────────────────────┘

Illustration: 96x96px, gray-400 stroke
Title: H3, gray-900
Description: Body, gray-600
CTA: Primary button
Padding: 80px vertical
```

---

### Loading Skeleton

Shimmer effect for content loading.

```
Background: gray-200
Shimmer: linear-gradient (gray-200 → gray-100 → gray-200)
Animation: 1.5s ease-in-out infinite
Border-radius: matches content shape
```

**Skeleton Variants:**
- Text line: height 16px, width variable
- Card: matches card dimensions
- Table row: matches table height
- Avatar: circular, 40px

---

## 4. ADVANCED PREMIUM TOUCHES

### Micro Interactions

**Button Press**
```
Scale: 0.98
Duration: 50ms
Timing: ease-out
```

**Hover Transitions**
```
Duration: 150ms
Timing: cubic-bezier(0.4, 0, 0.2, 1)
Properties: background, border, color, transform
```

**Modal Open Animation**
```
Opacity: 0 → 1
Scale: 0.95 → 1
Duration: 200ms
Timing: ease-out
```

**Tooltip Appear**
```
Opacity: 0 → 1
Transform: translateY(4px) → translateY(0)
Duration: 150ms
Delay: 300ms
```

---

### Layering & Depth

**Background Layering**
```
L1 - Page background: gray-50
L2 - Content surface: white
L3 - Elevated cards: white + shadow-md
L4 - Dropdowns/popovers: white + shadow-lg
L5 - Modals: white + shadow-lg + backdrop
```

**Visual Hierarchy**
- Use subtle shadows, not heavy borders
- 1px borders maximum (gray-200)
- Soft color backgrounds for sections
- Consistent spacing rhythm

---

### Consistent Spacing Rhythm

**8px Grid System**
All spacing uses multiples of 8:
- Internal: 8, 16, 24px
- External: 16, 24, 32, 40px
- Sections: 48, 64px

**Alignment**
- Left-align text content
- Center modals and empty states
- Right-align actions and secondary content
- Use flexbox for consistent alignment

---

### Clean Alignment Grid

**Desktop Grid**
```
Container: max-width 1280px
Columns: 12
Gutter: 24px
Margin: 40px
```

**Tablet Grid**
```
Container: 100%
Columns: 8
Gutter: 16px
Margin: 24px
```

**Mobile Grid**
```
Container: 100%
Columns: 4
Gutter: 16px
Margin: 16px
```

---

## 5. DARK MODE

Matching dark mode tokens for 24/7 enterprise use.

### Dark Mode Colors

**Backgrounds**
```
dark-bg-primary: #0A0A0A   (Main background)
dark-bg-surface: #171717   (Card surface)
dark-bg-elevated: #262626  (Elevated elements)
```

**Borders**
```
dark-border: #404040  (Subtle dividers)
```

**Text**
```
dark-text-primary: #FAFAFA    (Headings)
dark-text-secondary: #A3A3A3  (Body text)
dark-text-muted: #737373      (Secondary)
```

**Brand Colors (Adjusted)**
```
primary-500: #34D399  (Slightly brighter green for dark)
primary-600: #22C55E  (Hover state)
```

**Status Colors**
```
Success: #34D399  (Adjusted for dark)
Warning: #FBBF24  (Adjusted amber)
Error: #F87171    (Adjusted red)
Info: #38BDF8     (Adjusted sky)
```

---

### Dark Mode Shadows

Shadows are more subtle in dark mode:

```
dark-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3)
dark-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4)
dark-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5)
```

---

### Dark Mode Components

**Buttons**
- Primary: Keep primary-500 (bright green)
- Secondary: Adjust to lighter outline
- Ghost: Hover bg: dark-bg-elevated

**Inputs**
- Background: dark-bg-surface
- Border: dark-border
- Focus ring: primary-500/30

**Cards**
- Background: dark-bg-surface
- Border: dark-border (subtle)

**Sidebar**
- Background: dark-bg-surface
- Active: primary-500/20 bg

---

### Accessibility in Dark Mode

**Contrast Requirements:**
- Text on dark bg: minimum 7:1 (AAA)
- Borders visible: use gray-700/800
- Focus rings: always visible
- Status colors: tested for contrast

---

## 6. NAMING CONVENTIONS

### Scalable System Organization

**Color Naming:**
```
{category}-{value}
Examples: primary-500, gray-200, success-600
```

**Component Naming:**
```
{component}-{variant}-{state}
Examples: 
  button-primary-hover
  input-text-error
  badge-success
```

**Spacing Variables:**
```
spacing-{size}
Examples: spacing-sm, spacing-lg, spacing-3xl
```

**Typography Classes:**
```
text-{style}
Examples: text-h1, text-body, text-caption
```

---

## 7. FIGMA COMPONENT STRUCTURE

### Component Organization

**Pages:**
1. 📐 Design Tokens
2. 🎨 Foundations
3. 🧩 Components
4. 📱 Patterns
5. 🖼️ Layouts
6. 🌓 Dark Mode

**Components Hierarchy:**
```
Components/
├── Buttons/
│   ├── Primary
│   ├── Secondary
│   ├── Ghost
│   ├── Destructive
│   └── Icon
├── Inputs/
│   ├── Text
│   ├── Password
│   ├── Select
│   ├── Textarea
│   ├── Checkbox
│   ├── Radio
│   └── Toggle
├── Cards/
│   ├── Standard
│   ├── Elevated
│   └── Section
├── Navigation/
│   ├── Sidebar Item
│   ├── Topbar
│   └── Breadcrumb
├── Feedback/
│   ├── Badge
│   ├── Alert
│   ├── Toast
│   └── Progress
└── Overlays/
    ├── Modal
    ├── Dropdown
    └── Popover
```

---

## 8. HOW EVERYTHING CONNECTS

### Design Token Flow

```
Design Tokens (Variables)
    ↓
Foundation Layer (Colors, Typography, Spacing)
    ↓
Component Library (Buttons, Inputs, Cards)
    ↓
Pattern Library (Forms, Tables, Lists)
    ↓
Page Templates (Dashboard, Settings, etc.)
```

### Implementation Workflow

1. **Define tokens** in Figma variables
2. **Apply tokens** to base components
3. **Create variants** for each state
4. **Build patterns** from components
5. **Assemble layouts** from patterns
6. **Test dark mode** for all components

---

## 9. USAGE GUIDELINES

### Do's ✅

- Use 8px spacing grid religiously
- Keep shadows subtle and soft
- Maintain consistent border radius
- Use semantic color names
- Test dark mode for everything
- Ensure WCAG AA compliance minimum
- Use Inter font consistently
- Keep animations under 200ms
- Apply proper visual hierarchy
- Use whitespace generously

### Don'ts ❌

- Don't use neon or bright colors
- Don't use heavy drop shadows
- Don't mix border radius sizes randomly
- Don't use more than 2 font families
- Don't use flashy animations
- Don't ignore dark mode
- Don't skip accessibility testing
- Don't overcrowd layouts
- Don't use thin borders (< 1px)
- Don't break the spacing grid

---

## 10. EXPORT & HANDOFF

### For Developers

**Design Tokens Export:**
- JSON format with all variables
- CSS custom properties
- Tailwind config format

**Component Specs:**
- Dimensions and spacing
- Color values (hex, rgb)
- Typography properties
- Shadow values
- Animation timing

**Assets:**
- SVG icons (24x24, 20x20, 16x16)
- Illustration exports
- Logo variants

---

## Final Notes

This design system is built for:
- **Consistency** across all product surfaces
- **Scalability** as the product grows
- **Accessibility** for all users
- **Developer handoff** with clear specifications
- **Premium quality** that matches funded startups

**Design Inspiration:**
- Stripe Dashboard (clean data presentation)
- Linear (smooth interactions, typography)
- Vercel Dashboard (minimal, elegant)
- Notion (balanced hierarchy)
- GitHub (professional, functional)

**Result:** A timeless, elegant SaaS design system that feels premium without being flashy, professional without being boring, and modern without chasing trends.

---

**Version:** 1.0  
**Last Updated:** 2026-02-11  
**Maintained By:** Design System Team
