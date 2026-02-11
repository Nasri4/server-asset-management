# Hormuud Telecom – Enterprise UI/UX Design System

## Style Direction

- Premium Enterprise Dashboard (AWS Console, Azure Portal, Stripe Dashboard)
- Professional, Clean, Structured, Minimal, Data-focused
- Strong visual hierarchy
- Enterprise-grade interface for telecom, cloud, fintech environments
- Serious, trustworthy, operations-focused design language

## Brand Color System (Mandatory)

### Primary Brand Green

- **Primary:** #00A651

### Secondary Brand Blue

- **Secondary:** #00AEEF

### Layout Backgrounds

- **Background Light:** #F6F9F8
- **Surface (Cards):** #FFFFFF

- **Dark Background:** #0B1F1C
- **Dark Cards:** #132E29

### Sidebar

- **Dark Sidebar Base:** #0F2F2B
- **Sidebar Hover:** #14413B
- **Sidebar Active Item:** #00A651 (white icon/text)

### Borders

- **Borders:** #E2E8F0

### Text

- **Text Primary:** #0F172A
- **Text Secondary:** #64748B

### Status Colors

- **Active/Success:** Brand Green (#00A651)
- **Info/Links/Focus:** Brand Blue (#00AEEF)
- **Warning:** Amber
- **Danger:** Red

### Design Tokens (Tailwind)

This project uses CSS variables in `src/app/globals.css` and maps them into Tailwind.

- Primary: `bg-primary text-primary-foreground`
- Secondary: `bg-secondary text-secondary-foreground`
- Focus rings: `focus-visible:ring-ring/40 focus-visible:border-ring`

- Sidebar background: `bg-sidebar text-sidebar-foreground`
- Sidebar hover: `hover:bg-sidebar-accent`
- Sidebar active: `bg-sidebar-primary text-sidebar-primary-foreground`

- Cards: `rounded-xl border bg-card shadow-sm p-6` (or use `.enterprise-card` utility)

## Button Design System

### Button Variants

- **Primary:** Brand Green (#00A651)
- **Secondary:** Brand Blue (#00AEEF)
- **Outline:** Transparent with Deep Green border + green text
- **Danger:** Rose (#F43F5E) background + white text
- **Ghost:** Transparent with hover state
- **Disabled:** Muted slate with reduced opacity

### Button Styling

- Rounded corners (rounded-lg)
- Soft hover effects (subtle scale or brightness)
- Smooth transitions (160ms ease)
- Proper padding (px-4 py-2 for default, px-6 py-2.5 for large)
- Shadow on hover for lift effect

## Typography

- **Font Family:** Inter (sans-serif)
- **Page Titles:** text-2xl font-bold tracking-tight text-slate-900 dark:text-white
- **Section Titles:** text-lg font-semibold text-slate-800 dark:text-slate-100
- **Card Titles:** text-base font-semibold text-slate-900 dark:text-white
- **Body Text:** text-sm text-slate-600 dark:text-slate-300
- **Table Text:** text-sm font-medium text-slate-700 dark:text-slate-200
- **Labels:** text-xs font-medium uppercase tracking-wide text-slate-500
- **Metrics:** text-3xl font-bold for dashboard numbers

## Layout Structure

### Sidebar

- Fixed left sidebar (256px width, collapsible to 64px)
- Hover to expand when collapsed
- Sections with dividers
- Active state highlighting
- Icon + label layout

Navigation order (enterprise): Dashboard, Servers, Maintenance, Incidents, Monitoring, Network, Locations, Racks, Engineers, Teams, Applications, Reports, Settings.

### Topbar

- White topbar (`bg-card`) with subtle border
- Page title on the left
- Right side: Search, Notifications, Avatar
- Profile/settings menu
- Dark mode toggle

### Content Area

- Max-width container (max-w-7xl)
- Proper padding (px-6 py-8)
- 8px spacing grid system
- Responsive breakpoints

## Dashboard Components

### Summary Cards

Each card must include:

- Icon with status color indicator
- Large metric number (text-3xl font-bold)
- Label/title
- Trend indicator (up/down arrow with percentage)
- Soft border (border-slate-200)
- Hover elevation effect
- Rounded-xl corners
- Background: white (light) / slate-800 (dark)

### Metrics to Display

- Total Servers
- Active Servers / Inactive Servers
- Servers by Status (Online, Offline, Maintenance)
- Active Incidents
- Overdue Maintenance
- Monitoring Alerts
- System Health Score

### Analytics Charts

- Server distribution by location/team (Bar chart)
- Maintenance completion progress (Progress bars or Gauge)
- Incident severity breakdown (Pie/Donut chart)
- Server health / uptime gauge (Radial gauge)
- Trend lines for historical data

## Component Specifications

### Tables

- Sticky header with shadow
- Row hover highlight (bg-slate-50 hover)
- Status badges (rounded-full px-2.5 py-0.5 text-xs)
- Right-aligned action buttons
- Alternating row colors for large datasets
- Loading skeleton states
- Empty state with icon + message
- Pagination controls

### Forms

- Clean, aligned labels (text-sm font-medium mb-1)
- Proper input spacing
- Validation states (success, error, warning)
- Section grouping with dividers
- Helper text below inputs
- Required field indicators
- Inline validation feedback

### Cards

- rounded-xl borders
- Soft shadow (shadow-sm, shadow-md on hover)
- p-6 padding
- Clean header with optional actions
- Proper content spacing
- Optional badge/status indicator

### Modal/Dialog

- Backdrop blur
- Slide-in animation
- Clear header with close button
- Action buttons in footer
- Confirmation dialogs for destructive actions

## UX Polish & Enhancements

### Loading States

- Skeleton loaders for cards, tables, forms
- Spinner for button loading
- Progress bars for long operations
- Shimmer animation

### Empty States

- Centered icon (96x96)
- Clear message
- Call-to-action button
- Helpful illustration

### Notifications

- Toast notifications (top-right)
- Success, warning, error, info variants
- Auto-dismiss (3-5 seconds)
- Action buttons optional
- Stacked for multiple

### Animations

- Fade-in for page load
- Slide-in for modals/drawers
- Hover lift for cards (2px translateY)
- Smooth transitions (160ms ease)
- No flashy or distracting animations

### Dark Mode

- Full dark mode support
- Toggle in topbar
- Proper contrast ratios
- Adjusted shadows for dark backgrounds
- Consistent across all components

### Extra Features

- Floating action buttons for quick actions
- Smart search bars with filters
- Quick filter chips/badges
- Tooltips for icons and abbreviated text
- Activity indicators (pulsing dot)
- Alert badges (notification count)
- Breadcrumb navigation
- Keyboard shortcuts
- Command palette (Cmd+K)

## Design Restrictions

### DO NOT Use

- ❌ Neon colors or bright gradients
- ❌ Heavy drop shadows
- ❌ Thick borders (>2px)
- ❌ Playful or consumer-style UI
- ❌ Childish icons or illustrations
- ❌ Cluttered layouts
- ❌ Oversized fonts (>3xl except for hero metrics)
- ❌ Flashy animations

### DO Use

- ✅ Subtle shadows
- ✅ Clean borders (1px)
- ✅ Professional color palette
- ✅ Structured hierarchy
- ✅ Data-focused design
- ✅ Consistent spacing
- ✅ Enterprise iconography

---

**This design system is the single source of truth for all UI/UX implementation.**

The final UI must look like a real telecom infrastructure operations dashboard used by engineers and managers in a professional enterprise environment (AWS, Azure, Stripe, NOC dashboards).
