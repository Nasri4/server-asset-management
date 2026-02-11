# 🎨 V2 Premium Styling - Quick Template

## ✅ What's Ready Right Now

### **Components Created:**

1. ✅ `premium-table.tsx` - All premium table components
2. ✅ `data-table-wrapper.tsx` - Page wrapper with search/filters
3. ✅ `v2-showcase/page.tsx` - Live demo of all features

### **Pages with V2 Styling:**

- ✅ **Dashboard** (`/dashboard`) - Stats and charts
- ✅ **Servers** (`/servers`) - Premium server list
- ✅ **Security** (`/security`) - Compliance badges
- ✅ **V2 Showcase** (`/v2-showcase`) - **DEMO PAGE** ⭐

---

## 🚀 How to Apply V2 to Any Page (5 Steps)

### **Step 1: Add Imports**

```tsx
// Add these imports at the top:
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

### **Step 2: Add Status Helper**

```tsx
// Add this helper function:
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

### **Step 3: Replace Table Wrapper**

**Find:**

```tsx
<Table>
```

**Replace with:**

```tsx
<PremiumTable>
```

### **Step 4: Update Table Header**

**Find:**

```tsx
<TableHeader>
  <TableRow>
    <TableHead>Column Name</TableHead>
  </TableRow>
</TableHeader>
```

**Replace with:**

```tsx
<PremiumTableHeader>
  <tr>
    <PremiumTableHead sortable onSort={() => toggleSort("field")}>
      Column Name
    </PremiumTableHead>
  </tr>
</PremiumTableHeader>
```

### **Step 5: Update Table Body**

**Find:**

```tsx
<TableBody>
  <TableRow key={row.id}>
    <TableCell>{row.name}</TableCell>
    <TableCell>
      <Badge>{row.status}</Badge>
    </TableCell>
    <TableCell>
      <Button variant="ghost" size="icon">
        <Eye className="h-4 w-4" />
      </Button>
    </TableCell>
  </TableRow>
</TableBody>
```

**Replace with:**

```tsx
<PremiumTableBody>
  <PremiumTableRow key={row.id}>
    <PremiumTableCell>{row.name}</PremiumTableCell>
    <PremiumTableCell>
      <PremiumStatusBadge variant={getStatusVariant(row.status)}>
        {row.status}
      </PremiumStatusBadge>
    </PremiumTableCell>
    <PremiumTableCell>
      <PremiumActionButton
        variant="view"
        icon={<Eye className="h-4 w-4" />}
        onClick={() => handleView(row)}
      />
    </PremiumTableCell>
  </PremiumTableRow>
</PremiumTableBody>
```

---

## 📋 Complete Example

### **Before (Old V1):**

```tsx
<Card>
  <CardHeader>
    <CardTitle>Incidents</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Server</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {incidents.map((incident) => (
          <TableRow key={incident.id}>
            <TableCell>{incident.server}</TableCell>
            <TableCell>
              <Badge variant="outline">{incident.status}</Badge>
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon">
                <Eye className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### **After (New V2):**

```tsx
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Incidents
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Track and manage system incidents
      </p>
    </div>
    <Button size="sm">
      <Plus className="mr-2 h-4 w-4" />
      Log Incident
    </Button>
  </div>

  <PremiumTable>
    <PremiumTableHeader>
      <tr>
        <PremiumTableHead sortable onSort={() => handleSort("server")}>
          Server
        </PremiumTableHead>
        <PremiumTableHead sortable onSort={() => handleSort("status")}>
          Status
        </PremiumTableHead>
        <PremiumTableHead className="text-center">Actions</PremiumTableHead>
      </tr>
    </PremiumTableHeader>
    <PremiumTableBody>
      {incidents.map((incident) => (
        <PremiumTableRow key={incident.id}>
          <PremiumTableCell>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-400" />
              <span className="font-medium">{incident.server}</span>
            </div>
          </PremiumTableCell>
          <PremiumTableCell>
            <PremiumStatusBadge variant={getStatusVariant(incident.status)}>
              {incident.status}
            </PremiumStatusBadge>
          </PremiumTableCell>
          <PremiumTableCell>
            <div className="flex items-center justify-center gap-1">
              <PremiumActionButton
                variant="view"
                icon={<Eye className="h-4 w-4" />}
                onClick={() => handleView(incident)}
              />
              <PremiumActionButton
                variant="edit"
                icon={<Pencil className="h-4 w-4" />}
                onClick={() => handleEdit(incident)}
              />
            </div>
          </PremiumTableCell>
        </PremiumTableRow>
      ))}
    </PremiumTableBody>
  </PremiumTable>
</div>
```

---

## 🎯 Key Changes Summary

### ✨ **Visual Improvements:**

1. ✅ Sticky header with dark background
2. ✅ Uppercase column labels (auto-applied by `PremiumTableHead`)
3. ✅ Status badges with colored dots
4. ✅ Circular action buttons with hover effects
5. ✅ Clean spacing and typography
6. ✅ Row hover states (auto-applied by `PremiumTableRow`)

### 🔧 **Component Replacements:**

| Old Component                          | New Component                         |
| -------------------------------------- | ------------------------------------- |
| `<Table>`                              | `<PremiumTable>`                      |
| `<TableHeader>`                        | `<PremiumTableHeader>`                |
| `<TableHead>`                          | `<PremiumTableHead>`                  |
| `<TableBody>`                          | `<PremiumTableBody>`                  |
| `<TableRow>`                           | `<PremiumTableRow>`                   |
| `<TableCell>`                          | `<PremiumTableCell>`                  |
| `<Badge variant="outline">`            | `<PremiumStatusBadge variant={...}>`  |
| `<Button variant="ghost" size="icon">` | `<PremiumActionButton variant={...}>` |

---

## 📊 Current Status

### **✅ Fully V2 Styled:**

- Dashboard
- Servers
- Security
- V2 Showcase (Demo)

### **⏳ Ready for V2 (Components Available):**

- Incidents
- Maintenance
- Network
- Locations
- Hardware
- Racks
- Engineers
- Teams
- Applications
- Monitoring
- Visits

### **🎨 What You See Now:**

Go to **`/v2-showcase`** to see the complete V2 design in action!

All the components are ready - you can apply them to any page using the 5-step template above.

---

## 🚀 Quick Win

**Want to see V2 on a real page?** Just tell me which page (incidents, maintenance, network, etc.) and I'll update it immediately using this template!

**Example:** "Apply V2 to incidents page" → I'll update the entire page in seconds using the template above.
