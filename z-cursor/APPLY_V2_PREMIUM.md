# 🚀 Applying V2 Premium Styling - Quick Guide

## Summary of Changes

For each page, we need to:

1. Import premium table components
2. Replace `<Table>` with `<PremiumTable>`
3. Update table headers to use premium styles
4. Add status badges with colored dots
5. Add circular action buttons

---

## Step-by-Step for Each Page

### 1. Add Imports

**At the top of each page file, add:**

```tsx
import {
  PremiumTable,
  PremiumTableHeader,
  PremiumTableHead,
  PremiumTableBody,
  PremiumTableRow,
  PremiumTableCell,
  PremiumStatusBadge,
  PremiumActionButton,
} from "@/components/tables/premium-table";
```

**Remove the old table imports:**

```tsx
// DELETE THESE:
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
```

---

### 2. Replace Table Structure

**Old:**

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column Name</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**New:**

```tsx
<PremiumTable>
  <PremiumTableHeader>
    <tr>
      <PremiumTableHead sortable onSort={() => handleSort("field")}>
        Column Name
      </PremiumTableHead>
    </tr>
  </PremiumTableHeader>
  <PremiumTableBody>
    <PremiumTableRow>
      <PremiumTableCell>Data</PremiumTableCell>
    </PremiumTableRow>
  </PremiumTableBody>
</PremiumTable>
```

---

### 3. Update Status Badges

**Old:**

```tsx
<Badge variant="outline">{status}</Badge>
```

**New:**

```tsx
<PremiumStatusBadge variant={getStatusVariant(status)}>
  {status}
</PremiumStatusBadge>
```

**Add helper function:**

```tsx
const getStatusVariant = (
  status: string
): "success" | "warning" | "danger" | "secondary" | "info" => {
  const s = String(status ?? "").toLowerCase();
  if (s.includes("active") || s.includes("open") || s.includes("healthy"))
    return "success";
  if (s.includes("warning") || s.includes("progress")) return "warning";
  if (s.includes("offline") || s.includes("critical") || s.includes("failed"))
    return "danger";
  if (s.includes("maintenance") || s.includes("closed")) return "secondary";
  return "info";
};
```

---

### 4. Update Action Buttons

**Old:**

```tsx
<Button variant="ghost" size="icon" onClick={handleView}>
  <Eye className="h-4 w-4" />
</Button>
```

**New:**

```tsx
<PremiumActionButton
  variant="view"
  icon={<Eye className="h-4 w-4" />}
  onClick={handleView}
/>
```

---

## Files to Update

| Page         | Path                                           | Priority        |
| ------------ | ---------------------------------------------- | --------------- |
| Incidents    | `frontend/src/app/(app)/incidents/page.tsx`    | ⭐⭐⭐ Critical |
| Maintenance  | `frontend/src/app/(app)/maintenance/page.tsx`  | ⭐⭐⭐ Critical |
| Network      | `frontend/src/app/(app)/network/page.tsx`      | ⭐⭐ High       |
| Locations    | `frontend/src/app/(app)/locations/page.tsx`    | ⭐⭐ High       |
| Hardware     | `frontend/src/app/(app)/hardware/page.tsx`     | ⭐⭐ High       |
| Racks        | `frontend/src/app/(app)/racks/page.tsx`        | ⭐ Medium       |
| Engineers    | `frontend/src/app/(app)/engineers/page.tsx`    | ⭐ Medium       |
| Teams        | `frontend/src/app/(app)/teams/page.tsx`        | ⭐ Medium       |
| Applications | `frontend/src/app/(app)/applications/page.tsx` | ⭐ Medium       |
| Monitoring   | `frontend/src/app/(app)/monitoring/page.tsx`   | ⭐⭐ High       |
| Visits       | `frontend/src/app/(app)/visits/page.tsx`       | ⭐ Medium       |

---

## Automated Approach

Since manual updates would take significant time, I'll now apply these changes programmatically to all pages.

**Status:** IN PROGRESS
