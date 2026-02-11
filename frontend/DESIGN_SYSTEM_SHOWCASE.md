# 🎨 Design System Showcase
## Soft Green SaaS Dashboard Components

This document provides practical examples of how to use the new soft green design system in your React/Next.js components.

---

## 🎯 Quick Start

The design system is now fully implemented in:
- `src/app/globals.css` - All CSS variables and design tokens
- `tailwind.config.ts` - Extended Tailwind configuration
- `COLOR_PALETTE.md` - Color reference guide
- `FIGMA_DESIGN_SYSTEM.md` - Complete specifications

---

## 📦 Component Examples

### Primary Button

```tsx
<button className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 transition-colors duration-150">
  Create Server
</button>
```

**CSS Variables Alternative:**
```tsx
<button className="h-10 px-4 rounded-md bg-primary text-white font-medium text-sm hover:brightness-90 active:brightness-75 disabled:opacity-50 transition-all duration-150">
  Create Server
</button>
```

---

### Secondary Button (Outline)

```tsx
<button className="h-10 px-4 rounded-md border border-primary text-primary-600 font-medium text-sm hover:bg-primary-50 active:bg-primary-100 disabled:opacity-50 transition-colors duration-150">
  View Details
</button>
```

---

### Ghost Button

```tsx
<button className="h-10 px-4 rounded-md text-gray-700 font-medium text-sm hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 transition-colors duration-150">
  Cancel
</button>
```

---

### Destructive Button

```tsx
<button className="h-10 px-4 rounded-md bg-destructive text-white font-medium text-sm hover:bg-red-600 active:bg-red-700 disabled:opacity-50 transition-colors duration-150">
  Delete Server
</button>
```

---

### Icon Button

```tsx
<button className="h-10 w-10 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150">
  <svg className="w-5 h-5" /* icon SVG */ />
</button>
```

---

### Text Input

```tsx
<input
  type="text"
  className="h-10 w-full px-3 rounded-md border border-input bg-card text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-150"
  placeholder="Enter server name..."
/>
```

**With Error State:**
```tsx
<div className="space-y-1">
  <input
    type="text"
    className="h-10 w-full px-3 rounded-md border border-destructive bg-card text-sm text-foreground focus:outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20"
    placeholder="Enter server name..."
  />
  <p className="text-xs text-destructive">Server name is required</p>
</div>
```

---

### Select Dropdown

```tsx
<select className="h-10 w-full px-3 rounded-md border border-input bg-card text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer">
  <option>Select status...</option>
  <option>Active</option>
  <option>Inactive</option>
  <option>Maintenance</option>
</select>
```

---

### Toggle Switch

```tsx
<button
  role="switch"
  aria-checked="true"
  className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
>
  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 translate-x-6" />
</button>

{/* Off state: bg-gray-300, translate-x-1 */}
```

---

### Checkbox

```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    className="h-5 w-5 rounded border-2 border-gray-300 text-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 cursor-pointer"
  />
  <span className="text-sm text-foreground">I agree to the terms</span>
</label>
```

---

### Standard Card

```tsx
<div className="rounded-lg border border-border bg-card p-6 shadow-sm">
  <h3 className="text-lg font-semibold text-foreground mb-2">
    Server Details
  </h3>
  <p className="text-sm text-muted-foreground">
    View and manage server configuration
  </p>
</div>
```

---

### Elevated Card (with hover)

```tsx
<div className="rounded-lg border border-border bg-card p-6 shadow-md hover:shadow-lg transition-shadow duration-150 cursor-pointer">
  <h3 className="text-lg font-semibold text-foreground mb-2">
    Server Stats
  </h3>
  <p className="text-3xl font-bold text-foreground">127</p>
  <p className="text-sm text-muted-foreground mt-1">Active Servers</p>
</div>
```

---

### Status Badges

```tsx
{/* Success */}
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sam-success-soft text-sam-success border border-sam-success/20">
  ● Online
</span>

{/* Warning */}
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sam-warning-soft text-sam-warning border border-sam-warning/20">
  ⚠ Warning
</span>

{/* Error */}
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sam-error-soft text-sam-error border border-sam-error/20">
  ✕ Offline
</span>

{/* Info */}
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sam-info-soft text-sam-info border border-sam-info/20">
  ℹ Info
</span>
```

---

### Role Badges

```tsx
{/* Admin */}
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
  Admin
</span>

{/* Team Lead */}
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
  Team Lead
</span>

{/* Engineer */}
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200">
  Engineer
</span>
```

---

### Table

```tsx
<div className="rounded-lg border border-border overflow-hidden">
  <table className="w-full">
    <thead className="bg-muted/40">
      <tr>
        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Server Name
        </th>
        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </th>
        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Location
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-border hover:bg-muted/20">
        <td className="px-4 py-3 text-sm font-medium text-foreground">
          web-server-01
        </td>
        <td className="px-4 py-3 text-sm">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sam-success-soft text-sam-success">
            Online
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          US-East-1
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

### Sidebar Navigation Item

```tsx
{/* Default State */}
<button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-gray-100 transition-colors duration-150">
  <svg className="w-5 h-5" /* icon */ />
  <span>Dashboard</span>
</button>

{/* Active State */}
<button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground">
  <svg className="w-5 h-5" /* icon */ />
  <span>Servers</span>
</button>
```

---

### Page Header

```tsx
<div className="mb-8">
  <h1 className="text-3xl font-bold text-foreground tracking-tight">
    Server Management
  </h1>
  <p className="mt-2 text-base text-muted-foreground">
    Monitor and manage your infrastructure servers
  </p>
</div>
```

---

### Section Header

```tsx
<div className="mb-6">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-semibold text-foreground">
      Active Servers
    </h2>
    <button className="text-sm font-medium text-primary hover:text-primary-600">
      View All
    </button>
  </div>
  <div className="mt-2 h-px bg-border" />
</div>
```

---

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-20 px-4">
  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
    <svg className="w-12 h-12 text-gray-400" /* icon */ />
  </div>
  <h3 className="text-lg font-semibold text-foreground mb-2">
    No Servers Found
  </h3>
  <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
    You haven't created any servers yet. Get started by creating your first server.
  </p>
  <button className="h-10 px-4 rounded-md bg-primary text-white font-medium text-sm hover:bg-primary-600">
    Create Server
  </button>
</div>
```

---

### Modal Dialog

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
  
  {/* Modal */}
  <div className="relative bg-card rounded-xl shadow-lg p-8 w-full max-w-md">
    {/* Close button */}
    <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
      <svg className="w-5 h-5" /* close icon */ />
    </button>
    
    {/* Header */}
    <h3 className="text-xl font-semibold text-foreground mb-2">
      Confirm Action
    </h3>
    
    {/* Content */}
    <p className="text-sm text-muted-foreground mb-6">
      Are you sure you want to proceed with this action?
    </p>
    
    {/* Actions */}
    <div className="flex justify-end gap-3">
      <button className="h-10 px-4 rounded-md text-gray-700 font-medium text-sm hover:bg-gray-100">
        Cancel
      </button>
      <button className="h-10 px-4 rounded-md bg-primary text-white font-medium text-sm hover:bg-primary-600">
        Confirm
      </button>
    </div>
  </div>
</div>
```

---

### Loading Skeleton

```tsx
<div className="space-y-4 animate-pulse">
  {/* Card skeleton */}
  <div className="h-32 rounded-lg bg-gray-200" />
  
  {/* Text lines */}
  <div className="space-y-2">
    <div className="h-4 rounded bg-gray-200 w-3/4" />
    <div className="h-4 rounded bg-gray-200 w-1/2" />
  </div>
  
  {/* Button skeleton */}
  <div className="h-10 w-32 rounded-md bg-gray-200" />
</div>
```

---

## 🎨 Typography Scale

```tsx
{/* H1 - Page Title */}
<h1 className="text-3xl font-bold text-foreground tracking-tight">
  Page Title
</h1>

{/* H2 - Section Title */}
<h2 className="text-2xl font-semibold text-gray-800">
  Section Title
</h2>

{/* H3 - Subsection */}
<h3 className="text-lg font-semibold text-gray-800">
  Subsection Title
</h3>

{/* Body Large */}
<p className="text-base text-gray-700">
  Important body text with larger size
</p>

{/* Body - Default */}
<p className="text-sm text-gray-600">
  Standard body text for most content
</p>

{/* Caption */}
<p className="text-xs text-gray-500">
  Helper text, metadata, or timestamps
</p>

{/* Label */}
<label className="text-xs font-medium uppercase tracking-wide text-gray-700">
  Form Label
</label>
```

---

## 🌓 Dark Mode Support

All components automatically support dark mode when the `.dark` class is added to the root element:

```tsx
// Add to your layout or theme switcher
<html className="dark">
  {/* All components will use dark mode colors */}
</html>
```

The design system handles dark mode automatically through CSS variables. No component changes needed!

---

## 📐 Spacing Guidelines

Use the strict 8px spacing scale:

```tsx
{/* Tight spacing - 4px */}
<div className="space-y-1">

{/* Small spacing - 8px */}
<div className="space-y-2">

{/* Default spacing - 16px */}
<div className="space-y-4">

{/* Large spacing - 24px */}
<div className="space-y-6">

{/* Extra large - 32px */}
<div className="space-y-8">

{/* Section spacing - 48px */}
<div className="space-y-12">
```

---

## 🎯 Border Radius

Use consistent border radius values:

```tsx
{/* Small - 4px (badges, small buttons) */}
<div className="rounded-sm">

{/* Medium - 6px (buttons, inputs) */}
<div className="rounded-md">

{/* Large - 8px (cards, dropdowns) */}
<div className="rounded-lg">

{/* Extra large - 12px (modals) */}
<div className="rounded-xl">

{/* Full - Circular (avatars, status dots) */}
<div className="rounded-full">
```

---

## ✨ Shadows

```tsx
{/* Subtle shadow - cards at rest */}
<div className="shadow-sm">

{/* Default shadow - dropdowns */}
<div className="shadow-md">

{/* Elevated shadow - modals */}
<div className="shadow-lg">

{/* Focus shadow - interactive elements */}
<div className="focus:ring-2 focus:ring-primary/20">
```

---

## 🎬 Transitions

Use consistent transition timing:

```tsx
{/* Standard transition - 150ms */}
<button className="transition-colors duration-150">

{/* Smooth transition - 200ms */}
<div className="transition-all duration-200">

{/* Quick transition - 100ms */}
<div className="transition-opacity duration-100">
```

---

## 💡 Best Practices

### 1. **Use Design Tokens**
Always use CSS variables (`bg-primary`, `text-foreground`) instead of hardcoded colors.

### 2. **Maintain Spacing Rhythm**
Stick to the 8px spacing scale for consistency.

### 3. **Provide Hover States**
All interactive elements should have visible hover states.

### 4. **Include Focus States**
Always add focus rings for accessibility.

### 5. **Support Dark Mode**
Test all components in both light and dark modes.

### 6. **Use Semantic Colors**
- Primary actions → `bg-primary`
- Destructive actions → `bg-destructive`
- Success states → `bg-sam-success`
- Warning states → `bg-sam-warning`

### 7. **Keep It Simple**
Avoid overusing colors. Stick to the established palette.

---

## 🚀 Next Steps

1. Review the `FIGMA_DESIGN_SYSTEM.md` for complete specifications
2. Check `COLOR_PALETTE.md` for color reference
3. Use these examples as templates for new components
4. Maintain consistency across the application

---

**Design System Version:** 2.0 (Soft Green)  
**Last Updated:** 2026-02-11  
**Quality Standard:** Stripe + Linear + Vercel
