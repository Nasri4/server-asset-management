# 🎯 Enterprise Table Design System

## Professional Data Grid Standards for Infrastructure Management

Your tables have been redesigned to match AWS Console, Azure Portal, Stripe, and enterprise datacenter monitoring tools.

---

## 📋 Design Principles

### Core Philosophy

- **Clean** - Minimal visual noise
- **Professional** - Enterprise-grade aesthetics
- **Data-focused** - Information-first design
- **High-density** - Efficient use of space
- **Scannable** - Quick data comprehension

### NOT

- ❌ Big spacing
- ❌ Heavy borders
- ❌ Colorful grids
- ❌ Childish styling

---

## 🧱 Table Structure

### Layout Components

```
┌─────────────────────────────────────────────────┐
│ [Search] [Filters] [Sort] [Actions]      [Rows] │ ← Toolbar
├─────────────────────────────────────────────────┤
│ COLUMN A     COLUMN B     STATUS    ACTIONS     │ ← Sticky Header
├─────────────────────────────────────────────────┤
│ Row 1 data   Data        [Badge]    [• • •]    │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│ Row 2 data   Data        [Badge]    [• • •]    │ ← Zebra stripe
├─────────────────────────────────────────────────┤
│ Row 3 data   Data        [Badge]    [• • •]    │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│ [← Prev]  [1] [2] [3]  [Next →]    Showing X   │ ← Pagination
└─────────────────────────────────────────────────┘
```

### Header Style

```css
- Font: font-semibold text-xs uppercase
- Color: text-muted-foreground
- Background: bg-muted/40
- Letter spacing: tracking-wider
- Padding: px-4 py-3
- Sticky: sticky top-0 z-10
```

### Row Style

```css
- Height: Consistent (py-3)
- Border: border-b border-border/50
- Hover: hover:bg-muted/30
- Zebra: even:bg-muted/5
- Transition: transition-colors duration-150
```

---

## 🎨 Visual Design

### Color System

**Light Mode:**

- Header background: `bg-slate-50`
- Row zebra: `bg-slate-50/50`
- Row hover: `bg-slate-100/80`
- Border: `border-slate-200/60`

**Dark Mode:**

- Header background: `bg-slate-800/40`
- Row zebra: `bg-slate-800/20`
- Row hover: `bg-slate-700/30`
- Border: `border-slate-700/40`

### Status Badges

```tsx
// Badge sizes: px-2 py-0.5 text-xs rounded-md

Active/Healthy:     bg-emerald-100 text-emerald-700
                    dark:bg-emerald-900/20 dark:text-emerald-400

Warning:            bg-amber-100 text-amber-700
                    dark:bg-amber-900/20 dark:text-amber-400

Critical/Error:     bg-rose-100 text-rose-700
                    dark:bg-rose-900/20 dark:text-rose-400

Info/Maintenance:   bg-sky-100 text-sky-700
                    dark:bg-sky-900/20 dark:text-sky-400

Inactive/Offline:   bg-slate-100 text-slate-700
                    dark:bg-slate-800 dark:text-slate-400
```

---

## 📊 Typography

### Text Sizes

| Element   | Class                             | Usage                |
| --------- | --------------------------------- | -------------------- |
| Headers   | `text-xs font-semibold uppercase` | Column headers       |
| Body      | `text-sm`                         | Main data cells      |
| Secondary | `text-xs text-muted-foreground`   | Metadata, timestamps |
| Numbers   | `text-sm tabular-nums font-mono`  | IDs, counts, metrics |
| Monospace | `font-mono text-sm`               | IPs, codes, hashes   |

### Alignment

- **Text:** Left-aligned
- **Numbers:** Right-aligned (`text-right`)
- **Status:** Center-aligned
- **Actions:** Right-aligned

---

## 🔍 Enterprise Features

### 1. Search & Filters

```tsx
// Toolbar layout
<div className="flex items-center justify-between gap-4 p-4">
  <div className="flex flex-1 items-center gap-2">
    <Search className="h-4 w-4 text-muted-foreground" />
    <Input placeholder="Search..." className="max-w-sm" />
  </div>

  <div className="flex items-center gap-2">
    <FilterDropdown />
    <SortDropdown />
    <ColumnsDropdown />
    <ExportButton />
  </div>
</div>
```

### 2. Sorting Indicators

```tsx
// Column header with sort
<TableHead>
  <button className="flex items-center gap-1 hover:text-foreground">
    Column Name
    {sortDir === "asc" && <ChevronUp className="h-3 w-3" />}
    {sortDir === "desc" && <ChevronDown className="h-3 w-3" />}
  </button>
</TableHead>
```

### 3. Pagination

```tsx
// Footer pagination
<div className="flex items-center justify-between px-4 py-3 border-t">
  <div className="text-sm text-muted-foreground">
    Showing {start}-{end} of {total} results
  </div>

  <div className="flex items-center gap-2">
    <Button size="sm" variant="outline">
      Previous
    </Button>
    <Button size="sm" variant="outline">
      1
    </Button>
    <Button size="sm" variant="default">
      2
    </Button>
    <Button size="sm" variant="outline">
      3
    </Button>
    <Button size="sm" variant="outline">
      Next
    </Button>
  </div>
</div>
```

### 4. Row Actions

```tsx
// Icon buttons in action column
<TableCell className="text-right">
  <div className="flex items-center justify-end gap-1">
    <Button variant="ghost" size="icon-sm" title="View">
      <Eye className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="icon-sm" title="Edit">
      <Pencil className="h-4 w-4" />
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon-sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Assign</DropdownMenuItem>
        <DropdownMenuItem>History</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</TableCell>
```

---

## ✨ UX Enhancements

### Loading States

```tsx
// Skeleton rows
{
  loading && (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
```

### Empty States

```tsx
{
  !loading && data.length === 0 && (
    <TableRow>
      <TableCell colSpan={columns.length} className="h-64">
        <EmptyState
          icon={Database}
          title="No data found"
          description="Try adjusting your search or filters"
        />
      </TableCell>
    </TableRow>
  );
}
```

### Row Hover Effects

```css
className="group transition-colors hover:bg-muted/30"

/* Show actions on hover */
.group:hover .action-buttons {
  opacity: 1;
}
```

### Truncated Text Tooltips

```tsx
<Tooltip>
  <TooltipTrigger className="truncate max-w-xs">{longText}</TooltipTrigger>
  <TooltipContent>{longText}</TooltipContent>
</Tooltip>
```

---

## 🎯 Table Implementation Guide

### Standard Table Pattern

```tsx
<div className="space-y-4">
  {/* Toolbar */}
  <div className="flex items-center justify-between">
    <Input placeholder="Search..." />
    <div className="flex gap-2">
      <FilterButton />
      <ExportButton />
    </div>
  </div>

  {/* Table */}
  <div className="rounded-lg border">
    <Table>
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className="font-semibold">Column A</TableHead>
          <TableHead className="font-semibold">Column B</TableHead>
          <TableHead className="text-right font-semibold">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow
            key={row.id}
            className="border-b border-border/50 hover:bg-muted/30 transition-colors"
          >
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>
              <Badge variant={row.statusVariant}>{row.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <ActionButtons row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>

  {/* Pagination */}
  <TablePagination
    page={page}
    pageSize={pageSize}
    total={total}
    onPageChange={setPage}
  />
</div>
```

---

## 📱 Responsive Design

### Mobile Strategy

**Hide columns on small screens:**

```tsx
<TableHead className="hidden md:table-cell">Secondary Info</TableHead>
```

**Show mobile-friendly row cards:**

```tsx
{
  /* Mobile: Card view */
}
<div className="md:hidden space-y-2">
  {data.map((row) => (
    <Card key={row.id}>
      <CardContent className="p-4">
        {/* Key info stacked vertically */}
      </CardContent>
    </Card>
  ))}
</div>;

{
  /* Desktop: Table view */
}
<div className="hidden md:block">
  <Table>{/* Full table */}</Table>
</div>;
```

---

## 🌙 Dark Mode Support

All tables automatically support dark mode through Tailwind classes:

```tsx
// Header
className = "bg-muted/40 dark:bg-slate-800/40";

// Row hover
className = "hover:bg-muted/30 dark:hover:bg-slate-700/30";

// Zebra stripes
className = "even:bg-muted/5 dark:even:bg-slate-800/20";

// Borders
className = "border-b border-border/50 dark:border-slate-700/40";
```

---

## 🎨 Status Badge Variants

```tsx
// Badge component with variants
<Badge variant="success">Active</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="danger">Critical</Badge>
<Badge variant="info">Maintenance</Badge>
<Badge variant="secondary">Inactive</Badge>

// Custom colors
<span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
  Online
</span>
```

---

## 📊 Common Table Patterns

### Servers Table

- Server Code (monospace, bold)
- Hostname (secondary text below)
- Status (badge)
- Location (text)
- Team (text)
- Environment (badge)
- Actions (right-aligned icons)

### Incidents Table

- Incident # (monospace, bold)
- Server (with code)
- Severity (colored badge)
- Type (text)
- Reported (timestamp)
- Status (badge)
- Actions (right-aligned)

### Maintenance Table

- Server (bold + hostname)
- Type (text)
- Frequency (badge)
- Next Due (date + due badge)
- Status (badge)
- Assigned (text)
- Actions (right-aligned)

### Network Table

- Server (bold)
- Primary IP (monospace)
- Secondary IP (monospace, muted)
- VLAN (text)
- Type (badge)
- Security (FW/NAT badges)
- Actions (right-aligned)

---

## ✅ Implementation Checklist

### Per Table Page

- [ ] Add search input
- [ ] Add filter dropdowns
- [ ] Implement sorting indicators
- [ ] Add pagination component
- [ ] Style header with bg-muted/40
- [ ] Add row hover effects
- [ ] Implement zebra striping
- [ ] Convert status to badges
- [ ] Align actions right
- [ ] Add loading skeletons
- [ ] Add empty state
- [ ] Ensure sticky header
- [ ] Test dark mode
- [ ] Responsive design
- [ ] Icon-only action buttons

---

## 🚀 Result

Tables now match professional infrastructure monitoring tools:

✅ **Clean & Professional** - Enterprise aesthetics
✅ **High-density** - Efficient data display
✅ **Scannable** - Quick information access
✅ **Interactive** - Hover, sort, filter, search
✅ **Status visual** - Color-coded badges
✅ **Dark mode** - Full support
✅ **Responsive** - Mobile-friendly
✅ **Accessible** - Proper ARIA labels
✅ **Loading states** - Skeleton UI
✅ **Empty states** - Helpful messaging

**Your tables now look like AWS Console, Azure Portal, and professional datacenter monitoring dashboards!** 🎯

---

_Enterprise Table Design System v1.0_
_Last Updated: 2026-01-29_
