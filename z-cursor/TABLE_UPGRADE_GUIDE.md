# 🔧 Enterprise Table Upgrade Guide

## Step-by-Step Guide to Modernize Your Tables

This guide shows you how to apply the new enterprise table design to existing tables in your system.

---

## 🎯 Quick Start: Apply Enterprise Styles

### Step 1: Update Table Container

**Before:**

```tsx
<div className="overflow-auto rounded-lg border">
  <Table>{/* ... */}</Table>
</div>
```

**After:**

```tsx
<div className="enterprise-table-wrapper">
  <Table className="enterprise-table">{/* ... */}</Table>
</div>
```

### Step 2: Update Table Header

**Before:**

```tsx
<TableHeader className="sticky top-0 bg-muted/60">
  <TableRow>
    <TableHead>Server</TableHead>
    <TableHead>Status</TableHead>
  </TableRow>
</TableHeader>
```

**After:**

```tsx
<TableHeader>
  <TableRow className="hover:bg-transparent">
    <TableHead className="font-semibold">Server</TableHead>
    <TableHead className="font-semibold">Status</TableHead>
    <TableHead className="text-right font-semibold">Actions</TableHead>
  </TableRow>
</TableHeader>
```

### Step 3: Update Table Rows

**Before:**

```tsx
<TableRow className="hover:bg-muted/40">
  <TableCell>{server.code}</TableCell>
  <TableCell>{server.status}</TableCell>
</TableRow>
```

**After:**

```tsx
<TableRow className="group">
  <TableCell className="font-medium">
    <div className="font-semibold">{server.code}</div>
    {server.hostname && (
      <div className="text-xs text-muted-foreground mt-0.5">
        {server.hostname}
      </div>
    )}
  </TableCell>
  <TableCell>
    <span className={`status-badge status-badge-${getVariant(server.status)}`}>
      {server.status}
    </span>
  </TableCell>
  <TableCell className="text-right">
    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="table-action-btn" title="View">
        <Eye className="h-4 w-4" />
      </button>
      <button className="table-action-btn" title="Edit">
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  </TableCell>
</TableRow>
```

### Step 4: Convert Status Text to Badges

**Before:**

```tsx
<TableCell className="text-sm">{server.status}</TableCell>
```

**After:**

```tsx
<TableCell>
  <span
    className={`status-badge ${
      server.status === "Active"
        ? "status-badge-success"
        : server.status === "Warning"
          ? "status-badge-warning"
          : server.status === "Critical"
            ? "status-badge-danger"
            : "status-badge-secondary"
    }`}
  >
    {server.status}
  </span>
</TableCell>
```

Or using a helper function:

```tsx
function getStatusBadgeClass(status: string): string {
  const variants: Record<string, string> = {
    Active: "status-badge-success",
    Healthy: "status-badge-success",
    Warning: "status-badge-warning",
    Critical: "status-badge-danger",
    Error: "status-badge-danger",
    Maintenance: "status-badge-info",
    Inactive: "status-badge-secondary",
  };
  return `status-badge ${variants[status] || "status-badge-secondary"}`;
}

<span className={getStatusBadgeClass(server.status)}>{server.status}</span>;
```

### Step 5: Update Action Buttons

**Before:**

```tsx
<TableCell className="text-right">
  <Button variant="outline" size="sm">
    <Pencil className="h-4 w-4" /> Edit
  </Button>
  <Button variant="danger" size="sm">
    <Trash2 className="h-4 w-4" /> Delete
  </Button>
</TableCell>
```

**After:**

```tsx
<TableCell className="text-right">
  <div className="flex items-center justify-end gap-1">
    <button
      className="table-action-btn"
      onClick={() => handleView(row)}
      title="View details"
    >
      <Eye className="h-4 w-4" />
    </button>

    <button
      className="table-action-btn"
      onClick={() => handleEdit(row)}
      title="Edit"
    >
      <Pencil className="h-4 w-4" />
    </button>

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="table-action-btn" title="More actions">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleAssign(row)}>
          Assign
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleHistory(row)}>
          History
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => handleDelete(row)}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</TableCell>
```

---

## 📊 Complete Table Example

### Full Server Table with Enterprise Design

```tsx
import { Eye, Pencil, MoreVertical, Search } from "lucide-react";

export default function ServersTable() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filter and paginate
  const filtered = servers.filter(
    (s) =>
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.hostname?.toLowerCase().includes(search.toLowerCase()),
  );

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="flex flex-1 items-center gap-2 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 bg-transparent focus-visible:ring-0"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="enterprise-table-wrapper">
        <Table className="enterprise-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Server</TableHead>
              <TableHead className="font-semibold">Environment</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Location</TableHead>
              <TableHead className="font-semibold">Team</TableHead>
              <TableHead className="text-right font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="table-skeleton-row">
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : paged.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={6} className="table-empty-state">
                  <div className="py-8">
                    <Database className="mx-auto h-12 w-12 text-muted-foreground/40" />
                    <div className="mt-4 text-sm font-medium">
                      No servers found
                    </div>
                    <div className="mt-1 text-xs">
                      Try adjusting your search
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Data rows
              paged.map((server) => (
                <TableRow key={server.id} className="group">
                  <TableCell className="font-medium">
                    <div className="font-semibold table-mono">
                      {server.code}
                    </div>
                    {server.hostname && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {server.hostname}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <span
                      className={`status-badge ${
                        server.environment === "Production"
                          ? "status-badge-danger"
                          : "status-badge-info"
                      }`}
                    >
                      {server.environment}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className={getStatusBadgeClass(server.status)}>
                      {server.status}
                    </span>
                  </TableCell>

                  <TableCell className="text-sm">{server.location}</TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {server.team}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="table-action-btn"
                        onClick={() => handleView(server)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        className="table-action-btn"
                        onClick={() => handleEdit(server)}
                        title="Edit server"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="table-action-btn">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Assign Network</DropdownMenuItem>
                          <DropdownMenuItem>View History</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="table-pagination">
        <div className="text-sm text-muted-foreground">
          Showing {start + 1}-{Math.min(start + pageSize, total)} of {total}{" "}
          servers
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>

          {Array.from({ length: Math.min(5, Math.ceil(total / pageSize)) }).map(
            (_, i) => (
              <Button
                key={i}
                variant={page === i + 1 ? "default" : "outline"}
                size="sm"
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </Button>
            ),
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))
            }
            disabled={page >= Math.ceil(total / pageSize)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🎨 Status Badge Helper

Create a utility file: `lib/utils/status-badges.ts`

```typescript
export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "secondary";

export function getStatusVariant(status: string): StatusVariant {
  const statusMap: Record<string, StatusVariant> = {
    // Success states
    Active: "success",
    Healthy: "success",
    Online: "success",
    Complete: "success",
    Completed: "success",
    Operational: "success",
    Running: "success",

    // Warning states
    Warning: "warning",
    Degraded: "warning",
    Pending: "warning",
    Scheduled: "warning",
    Incomplete: "warning",

    // Danger states
    Critical: "danger",
    Error: "danger",
    Failed: "danger",
    Down: "danger",
    Offline: "danger",

    // Info states
    Maintenance: "info",
    Info: "info",
    Processing: "info",

    // Secondary states
    Inactive: "secondary",
    Disabled: "secondary",
    Unknown: "secondary",
  };

  return statusMap[status] || "secondary";
}

export function getStatusBadgeClass(status: string): string {
  const variant = getStatusVariant(status);
  return `status-badge status-badge-${variant}`;
}
```

Usage:

```tsx
import { getStatusBadgeClass } from "@/lib/utils/status-badges";

<span className={getStatusBadgeClass(server.status)}>{server.status}</span>;
```

---

## ✅ Table Upgrade Checklist

For each table page, complete these steps:

### Visual Design

- [ ] Add `enterprise-table-wrapper` to container
- [ ] Add `enterprise-table` class to `<Table>`
- [ ] Update header with `font-semibold` on each `<TableHead>`
- [ ] Add `hover:bg-transparent` to header `<TableRow>`
- [ ] Add `group` class to body `<TableRow>`
- [ ] Convert status text to status badges
- [ ] Make action buttons icon-only with `table-action-btn` class
- [ ] Align actions to right
- [ ] Add row hover opacity effects for actions

### Data Display

- [ ] Use `font-medium` or `font-semibold` for primary column
- [ ] Add secondary info below primary (with `text-xs text-muted-foreground`)
- [ ] Use `table-mono` class for IPs, codes, IDs
- [ ] Use `text-right` for numeric columns
- [ ] Truncate long text with tooltips

### Functionality

- [ ] Add search input in toolbar
- [ ] Add filter dropdowns
- [ ] Add sort indicators to headers
- [ ] Implement pagination component
- [ ] Add loading skeleton rows
- [ ] Add empty state component
- [ ] Add row count indicator

### Responsive

- [ ] Hide non-critical columns on mobile (`hidden md:table-cell`)
- [ ] Show mobile info below primary column
- [ ] Test table on mobile devices

### Dark Mode

- [ ] Test table in dark mode
- [ ] Verify badge colors work in dark mode
- [ ] Check border contrast

---

## 📋 Pages to Update

### Priority 1 (Core tables)

- [ ] `/servers` - Server list table
- [ ] `/incidents` - Incidents table
- [ ] `/maintenance` - Maintenance schedules table
- [ ] `/network` - Network assignments table

### Priority 2 (Secondary tables)

- [ ] `/hardware` - Hardware specifications table
- [ ] `/security` - Security configurations table
- [ ] `/monitoring` - Monitoring alerts table
- [ ] `/visits` - Site visits table

### Priority 3 (Admin tables)

- [ ] `/teams` - Teams list
- [ ] `/locations` - Locations list
- [ ] `/engineers` - Engineers list
- [ ] `/audit` - Audit logs table

---

## 🚀 Quick Wins

### Immediate Visual Improvements

1. **Add these classes globally** to all existing tables:

   ```tsx
   // Container
   className = "enterprise-table-wrapper";

   // Table element
   className = "enterprise-table";
   ```

2. **Convert all status text** to badges:

   ```tsx
   <span className={getStatusBadgeClass(status)}>{status}</span>
   ```

3. **Make action buttons icon-only**:
   ```tsx
   <button className="table-action-btn" title="Action name">
     <Icon className="h-4 w-4" />
   </button>
   ```

These three changes alone will dramatically improve the look of your tables!

---

## 📊 Before & After Comparison

### Before

```
┌────────────────────────────────────────────┐
│ Server Code | Status | Actions            │
├────────────────────────────────────────────┤
│ SRV-001     | Active | [Edit] [Delete]    │
│ SRV-002     | Warning| [Edit] [Delete]    │
└────────────────────────────────────────────┘
```

### After

```
┌────────────────────────────────────────────┐
│ SERVER            ENVIRONMENT    ACTIONS   │
├────────────────────────────────────────────┤
│ SRV-001          [Production]   [👁][✏][⋮]│
│ web-server-01     🟢 Active                │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│ SRV-002          [Engineering]  [👁][✏][⋮]│
│ test-db-01        🟡 Warning                │
└────────────────────────────────────────────┘
```

**Improvements:**

- ✅ Cleaner header (uppercase, semibold)
- ✅ Icon-only actions
- ✅ Status badges instead of text
- ✅ Secondary info below primary
- ✅ Subtle zebra striping
- ✅ Professional spacing

---

_Table Upgrade Guide v1.0_
_Last Updated: 2026-01-29_
