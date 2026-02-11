# 🚀 Quick Start Guide - V2 Setup

**Complete setup in 5 minutes**

---

## ⚡ **ONE-COMMAND SETUP**

### **Step 1: Run V2 Setup Script**

Open SQL Server Management Studio or sqlcmd and execute:

```sql
-- Execute this single file (creates everything):
backend\sql\SETUP_V2.sql
```

This script will:

- ✅ Create `Users`, `roles`, `user_roles`, `role_permissions` tables
- ✅ Create `activity_log`, `saved_views`, `attachments`, `notifications` tables
- ✅ Enhance `servers` table with V2 columns
- ✅ Seed Admin and Engineer roles
- ✅ Create first admin user (username: `admin`, password not set)
- ✅ Seed 3 system saved views

**Expected output:**

```
========================================
SERVER ASSET MANAGEMENT V2 SETUP
========================================

STEP 1: Creating Auth Tables...
  ✓ Created Users table
  ✓ Created roles table
  ✓ Seeded Admin role
  ✓ Seeded Engineer role
  ✓ Created user_roles table
  ✓ Created role_permissions table
  ✓ Seeded Admin permissions
  ✓ Seeded Engineer permissions

STEP 2: Creating V2 Feature Tables...
  ✓ Created activity_log table
  ✓ Created saved_views table
  ✓ Seeded system saved views
  ✓ Created attachments table
  ✓ Created notifications table

STEP 3: Enhancing Servers Table...
  ✓ Added last_seen_at column
  ✓ Added health_status column
  ✓ Added criticality column
  ✓ Added tags column
  ✓ Added deleted_at column

STEP 4: Creating First Admin User...
  ✓ Created admin user
  ⚠ PASSWORD NOT SET - Use bootstrap API

========================================
V2 SETUP COMPLETE!
========================================
```

---

### **Step 2: Set Admin Password**

**Method 1: Using API (Easiest)**

```bash
# Set admin password using bootstrap API
curl -X POST http://localhost:3000/auth/bootstrap/admin \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: dev-bootstrap-secret-2024" \
  -d '{
    "username": "admin",
    "password": "Admin@2026",
    "fullName": "System Administrator",
    "teamId": 1
  }'
```

**Expected Response:**

```json
{
  "data": {
    "userId": 1,
    "username": "admin",
    "fullName": "System Administrator",
    "teamId": 1,
    "roles": ["Admin"],
    "permissions": ["servers.create", "servers.read", ...]
  }
}
```

**Method 2: Direct SQL** (if API doesn't work)

```sql
-- First, get a bcrypt hash of your password
-- You can use: https://bcrypt-generator.com/
-- Or run: node -e "console.log(require('bcrypt').hashSync('Admin@2026', 12))"

-- Update admin user with hashed password
UPDATE dbo.Users
SET password_hash = '$2b$12$YOUR_BCRYPT_HASH_HERE'
WHERE username = 'admin';
```

---

### **Step 3: Install Frontend Package**

```bash
cd frontend
npm install cmdk
```

This installs the command palette library for global search (Cmd+K).

---

### **Step 4: Restart Backend (if running)**

```bash
cd backend
npm run dev
# or
node src/server.ts
```

---

### **Step 5: Test Login**

**Open:** `http://localhost:3001/login` (or your frontend URL)

**Credentials:**

- Username: `admin`
- Password: `Admin@2026` (or whatever you set)

**Expected:**

- ✅ Successful login
- ✅ Redirect to dashboard
- ✅ No console errors

---

## 🎯 **TEST V2 FEATURES**

### **1. Global Search** 🔍

**In the app:**

1. Press **Cmd+K** (Mac) or **Ctrl+K** (Windows)
2. Or click the **Search icon** in the topbar
3. Type: `server` or any server code
4. Click result to navigate

**Expected:** Modal opens with search results grouped by type

---

### **2. Saved Views** 💾

**Test in browser:**

```bash
# List system saved views for servers
curl http://localhost:3000/api/saved-views?resourceType=servers \
  -H "Cookie: sam-token=YOUR_JWT_TOKEN"
```

**Expected response:**

```json
{
  "data": [
    {
      "view_id": 1,
      "view_name": "All Servers",
      "resource_type": "servers",
      "filter_config": {},
      "is_default": true,
      "is_shared": true
    },
    {
      "view_id": 2,
      "view_name": "Production Servers",
      "filter_config": {"environment": ["Production"]},
      ...
    }
  ]
}
```

---

### **3. Activity Log** 📝

**Test in browser:**

```bash
# Get all activities
curl http://localhost:3000/api/activity \
  -H "Cookie: sam-token=YOUR_JWT_TOKEN"

# Get activities for specific server
curl http://localhost:3000/api/activity?resourceType=server&resourceId=1 \
  -H "Cookie: sam-token=YOUR_JWT_TOKEN"
```

**Expected:** List of activity events (will be empty initially, will populate as you use the system)

---

## 🔧 **TROUBLESHOOTING**

### **Issue: Login still fails with 500 error**

**Check:**

1. Backend logs for error details
2. Database has `Users`, `roles`, `user_roles` tables
3. Admin user exists: `SELECT * FROM dbo.Users WHERE username = 'admin'`
4. Admin role assigned: `SELECT * FROM dbo.user_roles WHERE user_id = 1`

**Verify tables exist:**

```sql
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN ('Users', 'roles', 'user_roles', 'activity_log', 'saved_views')
ORDER BY TABLE_NAME;
```

**Expected:** All 5 tables listed

---

### **Issue: Global Search not working**

**Check:**

1. Package installed: `npm list cmdk` (should show version)
2. Backend running: `http://localhost:3000/health` returns `{"ok":true}`
3. Search API works: `curl http://localhost:3000/api/search?q=test`

---

### **Issue: Bootstrap token invalid**

**Check your `.env` file:**

```env
# Should have this variable:
DEV_BOOTSTRAP_TOKEN=dev-bootstrap-secret-2024
```

Or set it before running curl:

```bash
# Use any token you want (dev only)
export TOKEN="my-secret-token"

curl -X POST http://localhost:3000/auth/bootstrap/admin \
  -H "x-bootstrap-token: $TOKEN" \
  -d '{"username":"admin","password":"Admin@2026","fullName":"Admin","teamId":1}'
```

---

## 📋 **SETUP CHECKLIST**

- [ ] Run `backend\sql\SETUP_V2.sql` in SQL Server
- [ ] Verify all tables created (Users, roles, activity_log, saved_views, etc.)
- [ ] Set admin password via bootstrap API or SQL
- [ ] Install `cmdk` package in frontend (`npm install cmdk`)
- [ ] Restart backend server
- [ ] Login with admin credentials
- [ ] Test Cmd+K global search
- [ ] Test saved views API
- [ ] Check activity log is capturing events

---

## 🎉 **SUCCESS INDICATORS**

When setup is complete, you should see:

✅ **Login works** - No 500 errors  
✅ **Dashboard loads** - All tables display  
✅ **Cmd+K works** - Search modal opens  
✅ **Search returns results** - Servers, incidents, etc. appear  
✅ **User menu shows** - Admin role displayed

---

## 📞 **NEED HELP?**

If you encounter errors, share:

1. Backend console logs (the 500 error details)
2. SQL Server error messages
3. Which step failed

I'll help you debug immediately!

---

**Ready to go? Run the setup script and let me know how it goes!** 🚀
