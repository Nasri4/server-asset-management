# 🚀 Network Management System - Installation Guide

## Quick Start Guide for Enhanced Network Management

Follow these steps to install and activate the enhanced network management system.

---

## 📋 Prerequisites

- SQL Server database access
- Node.js backend server
- Access to execute SQL migrations
- Admin/DBA permissions

---

## 🔧 Installation Steps

### Step 1: Run Database Migration

**Option A: Using SQL Server Management Studio (SSMS)**

1. Open SSMS and connect to your database
2. Open the migration file:
   ```
   backend/sql/migrations/2026-01-29_enhance-server-network-table.sql
   ```
3. Make sure you're connected to the correct database
4. Click **Execute** (F5)
5. Verify success message:
   ```
   Enhanced server_network table migration completed successfully
   ```

**Option B: Using Command Line (sqlcmd)**

```bash
cd backend/sql/migrations

sqlcmd -S your-server-name -d your-database-name -i 2026-01-29_enhance-server-network-table.sql
```

**Expected Output:**

```
Enhanced server_network table migration completed successfully
```

### Step 2: Verify Database Changes

Run this query to verify the table structure:

```sql
-- Check table structure
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'server_network'
ORDER BY ORDINAL_POSITION;
```

**Expected Columns (14 total):**

- network_id
- server_id
- ip_address
- secondary_ip ✨ NEW
- ipv6 ✨ NEW
- subnet
- vlan ✨ NEW
- gateway ✨ NEW
- dns_type ✨ NEW
- network_type
- bandwidth ✨ NEW
- firewall_enabled ✨ NEW
- nat_enabled ✨ NEW
- created_at
- updated_at

### Step 3: Verify Stored Procedures

```sql
-- Check if stored procedures were created
SELECT name, type_desc
FROM sys.procedures
WHERE name IN ('sp_assign_ip', 'sp_update_network');
```

**Expected Output:**

```
name                type_desc
sp_assign_ip        SQL_STORED_PROCEDURE
sp_update_network   SQL_STORED_PROCEDURE
```

### Step 4: Restart Backend Server

The backend code has been updated. Restart your Node.js server:

```bash
cd backend
npm run dev
# or
npm start
```

**Verify backend startup:**

- Check console for any errors
- Backend should start successfully
- Routes should be loaded

### Step 5: Test API Endpoints

**Test 1: Get All Networks**

```bash
curl http://localhost:3000/api/network \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test 2: Assign New Network (with new fields)**

```bash
curl -X POST http://localhost:3000/api/network/assign-ip \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "server_id": 1,
    "ip_address": "10.10.0.15",
    "secondary_ip": "10.10.0.16",
    "ipv6": "2001:db8::1",
    "subnet": "255.255.255.0",
    "vlan": "100",
    "gateway": "10.10.0.1",
    "dns_type": "Primary",
    "network_type": "LAN",
    "bandwidth": "10Gbps",
    "firewall_enabled": true,
    "nat_enabled": false
  }'
```

### Step 6: Test Frontend

1. Navigate to the network page in your browser:

   ```
   http://localhost:3000/network
   ```

2. Verify the enhanced form displays:
   - ✅ IP Configuration section (Primary IP, Secondary IP, IPv6)
   - ✅ Network Details section (Subnet, VLAN, Gateway, DNS)
   - ✅ Configuration section (Type, Bandwidth, Security checkboxes)

3. Test creating a network record with the new fields

4. Verify the table shows all new columns:
   - ✅ Primary IP, Secondary IP, VLAN
   - ✅ Type badge, Bandwidth
   - ✅ Security badges (FW, NAT)

---

## ✅ Verification Checklist

### Database

- [ ] Migration script executed successfully
- [ ] Table `server_network` has 14 columns
- [ ] Stored procedures `sp_assign_ip` and `sp_update_network` exist
- [ ] Indexes created: `IX_server_network_server_id`, `IX_server_network_ip_address`
- [ ] Foreign key constraint exists: `FK_server_network_server`

### Backend

- [ ] Server restarts without errors
- [ ] GET /api/network returns enhanced data
- [ ] POST /api/network/assign-ip accepts new fields
- [ ] PATCH /api/network/:id accepts new fields
- [ ] Validation works for required fields

### Frontend

- [ ] Network page loads successfully
- [ ] Form shows 3 organized sections
- [ ] All 12 new fields are visible
- [ ] Security checkboxes work
- [ ] Table displays new columns
- [ ] Edit dialog includes all fields
- [ ] CSV export includes all fields

---

## 🧪 Quick Test Scenario

**Test: Assign Multiple IPs to One Server**

1. Go to Network page
2. Select a server (e.g., "HOR-srv-0001")
3. Fill in first network:
   - Primary IP: `10.10.0.15`
   - Subnet: `255.255.255.0`
   - VLAN: `100`
   - Network Type: `LAN`
   - Bandwidth: `10Gbps`
   - ✅ Enable Firewall
4. Click "Assign Network"
5. Repeat for second network (same server):
   - Primary IP: `192.168.1.10`
   - Subnet: `255.255.255.0`
   - VLAN: `200`
   - Network Type: `Management`
6. Verify table shows **two rows** for the same server
7. Test editing both records
8. Test deleting one record

**Expected Result:** ✅ One server can have multiple network configurations!

---

## 🐛 Troubleshooting

### Issue: Migration fails with "object already exists"

**Solution:** The migration is idempotent. It safely adds new columns if they don't exist. Check if the columns were actually added:

```sql
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'server_network'
  AND COLUMN_NAME IN ('secondary_ip', 'ipv6', 'vlan', 'gateway');
```

### Issue: Backend validation errors

**Solution:** Make sure required fields are provided:

- `server_id` (required)
- `ip_address` (required)
- `subnet` (required)
- `network_type` (required)

All other fields are optional.

### Issue: Checkboxes not working in form

**Solution:** Make sure you're using the updated frontend code. The checkboxes should be registered with react-hook-form:

```tsx
<input type="checkbox" {...register("firewall_enabled")} />
<input type="checkbox" {...register("nat_enabled")} />
```

### Issue: Table columns not showing

**Solution:** The table is responsive. Some columns are hidden on smaller screens:

- `secondary_ip` - visible on md+ screens
- `vlan`, `security` - visible on lg+ screens
- `bandwidth` - visible on xl+ screens

Resize your browser window to see all columns.

---

## 📞 Support

If you encounter any issues:

1. Check the console for error messages
2. Verify database migration completed
3. Check backend logs
4. Review the `NETWORK_MANAGEMENT_SYSTEM.md` documentation
5. Test with the provided curl examples

---

## 🎉 Success!

If all steps pass, your enhanced network management system is ready to use!

**Features Now Available:**

- ✅ Multiple IPs per server
- ✅ IPv4 + IPv6 support
- ✅ VLAN management
- ✅ Gateway and DNS tracking
- ✅ Bandwidth documentation
- ✅ Security status tracking (Firewall, NAT)
- ✅ Professional UI with organized sections
- ✅ Comprehensive CSV export

---

_Installation Guide Version: 1.0_
_Last Updated: 2026-01-29_
