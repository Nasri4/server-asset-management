# TELCO Server Asset Management System

Enterprise-grade Telco infrastructure management platform built with **SQL Server**, **Node.js/Express**, and **Next.js 14**.

---

## System Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────▶│  Node.js API │────▶│  SQL Server  │
│  Frontend    │     │   (Express)  │     │   Database   │
│  Port 3000   │     │   Port 5000  │     │  Port 1433   │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │  Hormuud SMS │
                     │     API      │
                     └──────────────┘
```

---

## Prerequisites

- **SQL Server 2019+** (or SQL Server Express)
- **Node.js 18+**
- **npm** or **yarn**

---

## Setup Guide

### Step 1: Database Setup

1. Open **SQL Server Management Studio (SSMS)** or **Azure Data Studio**

2. Run the schema file to create the database and tables:
   ```
   database/schema.sql
   ```

3. Run stored procedures:
   ```
   database/stored-procedures.sql
   ```

4. Run seed data (creates default admin user, roles, permissions, sample locations):
   ```
   database/seed-data.sql
   ```

### Step 2: Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Edit .env with your SQL Server credentials
# Required: DB_SERVER, DB_PASSWORD, DB_DATABASE, JWT_SECRET

# Install dependencies
npm install

# Start the API server
npm run dev
```

The API will start on `http://localhost:5000`.

### Step 3: Frontend Setup

```bash
cd frontend

# Copy environment file (optional, defaults to localhost:5000)
cp .env.local.example .env.local

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:3000`.

### Step 4: First Login

- **Username:** `admin`
- **Password:** `Admin@123`

---

## Environment Variables

### Backend (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | API port (default: 5000) | No |
| `DB_SERVER` | SQL Server host | Yes |
| `DB_PORT` | SQL Server port (default: 1433) | No |
| `DB_DATABASE` | Database name | Yes |
| `DB_USER` | Database user | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `DB_TRUST_CERT` | Trust self-signed certs (default: true) | No |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_EXPIRES_IN` | Token expiry (default: 8h) | No |
| `CREDENTIAL_ENCRYPTION_KEY` | AES key for credential encryption | Yes |
| `SMS_API_TOKEN_URL` | Hormuud token endpoint | For SMS |
| `SMS_API_SEND_URL` | Hormuud send endpoint | For SMS |
| `SMS_API_USERNAME` | Hormuud API username | For SMS |
| `SMS_API_PASSWORD` | Hormuud API password | For SMS |
| `SMS_SENDER_ID` | SMS sender name | For SMS |
| `SMTP_HOST` | SMTP server (e.g. smtp.gmail.com) | For email OTP |
| `SMTP_PORT` | SMTP port (587 for TLS) | For email OTP |
| `SMTP_USER` | SMTP username / email | For email OTP |
| `SMTP_PASS` | SMTP password (Gmail: App Password) | For email OTP |
| `SMTP_FROM` | From address for outgoing mail | For email OTP |

### Frontend (.env.local)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: http://localhost:5000) |

---

## Role-Based Access Control (RBAC)

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Admin** | Global | Full access to everything |
| **Department Head** | Department | Manage all resources within their department |
| **Team Leader** | Team | Manage servers, incidents, maintenance within team |
| **Engineer** | Assigned | Manage servers assigned to them |
| **Viewer** | Department | Read-only access |

All pages, lists, and reports are automatically filtered by the user's role scope.

---

## System Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/dashboard` | KPIs, charts, alerts, recent activity |
| Server List | `/servers` | Browse, filter, search servers |
| Register Server | `/servers/register` | Multi-step server registration wizard |
| Server Detail | `/servers/[id]` | 360° view with all tabs |
| Locations | `/locations` | Site management with rack counts |
| Racks | `/racks` | Rack grid with occupancy |
| Rack View | `/racks/[id]` | Visual U-grid replacing paper sheets |
| Monitoring | `/monitoring` | Health status across all servers |
| Security | `/security` | Hardening and compliance overview |
| Applications | `/applications` | Application catalog |
| Maintenance | `/maintenance` | Schedule, track, SMS notify |
| Incidents | `/incidents` | Lifecycle: Open → Investigate → Resolve → Close |
| Engineers | `/engineers` | Engineer cards with server counts |
| Engineer Profile | `/engineers/[id]` | Full accountability view |
| Teams | `/teams` | Org structure with departments |
| Reports | `/reports` | Server inventory, incidents, warranty, compliance |
| Audit Log | `/audit-log` | Immutable activity trail |
| Administration | `/admin` | User management, roles, system settings |

---

## Key Features

### Server Registration (5-Step Wizard)
1. Basic info (code, hostname, environment, rack position, power type)
2. Hardware (vendor, model, serial, CPU, RAM, storage, warranty)
3. Network (IP, VLAN, subnet, gateway, DNS, firewall)
4. Security (OS, hardening, antivirus, backup)
5. Credentials (encrypted, OTP-protected viewing)

### Rack View (Paper Sheet Replacement)
- Visual U-position grid (42U standard)
- Color-coded by status
- Power type indicator (Single/Double)
- Serial number display
- Click-through to server detail
- Print-friendly layout

### OTP-Protected Credentials
- Server credentials encrypted at rest (AES)
- Viewing requires OTP verification (SMS or email)
- Every view logged in audit trail
- OTP expires after 5 minutes
- Maximum 3 attempts per OTP

### How OTP Is Sent
1. **Request**: User requests OTP (e.g. when viewing credentials).
2. **Delivery**:
   - If the user has a **phone number** and Hormuud SMS is configured → OTP is sent via **SMS**.
   - If SMS fails or no phone → OTP is sent via **email** (when SMTP is configured).
3. **Config**: Set `SMS_API_*` for SMS; set `SMTP_*` for email fallback.
4. **Gmail**: Use an [App Password](https://support.google.com/accounts/answer/185833) (not your normal password).

### SMS Integration (Hormuud)
- OTP delivery for credential access
- Maintenance schedule notifications to team and engineer
- Critical incident alerts to on-call team
- All SMS logged with delivery status

### Audit Logging
- Every create, update, delete logged
- Tracks: who, what, when, old value, new value, IP
- Sensitive actions flagged (credential access, role changes, deletions)
- Immutable — no edit or delete
- Filterable by entity, action, user, date

---

## API Endpoints Summary

### Auth
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user + permissions
- `POST /api/auth/change-password` — Change password

### Servers
- `GET /api/servers` — List (filtered, paginated)
- `GET /api/servers/:id` — Full detail (360° view)
- `POST /api/servers` — Register new server
- `PUT /api/servers/:id` — Update
- `POST /api/servers/:id/credentials/request-otp` — Request OTP
- `POST /api/servers/:id/credentials/verify` — Verify + view credentials
- `POST /api/servers/:id/assign` — Assign engineer

### Locations & Racks
- `GET/POST /api/locations`
- `GET/POST /api/racks`
- `GET /api/racks/:id/view` — Rack visual layout

### Operations
- `GET/POST/PUT /api/incidents`
- `GET/POST/PUT /api/maintenance`
- `GET/PUT /api/monitoring`
- `GET/PUT /api/security`
- `GET/POST /api/applications`

### People
- `GET/POST/PUT /api/engineers`
- `GET/POST/PUT /api/teams`
- `GET/POST/PUT /api/departments`

### Reports
- `GET /api/reports/server-inventory`
- `GET /api/reports/incident-summary`
- `GET /api/reports/maintenance-compliance`
- `GET /api/reports/warranty-expiry`

### Admin
- `GET/POST/PUT /api/admin/users`
- `GET /api/admin/roles`
- `GET /api/admin/permissions`
- `GET/PUT /api/admin/settings`

### Audit
- `GET /api/audit` — Paginated, filterable

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | SQL Server 2019+ |
| Backend | Node.js + Express |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Auth | JWT + OTP (SMS) |
| SMS | Hormuud SMS API |
| Encryption | AES (CryptoJS) |

---

## Project Structure

```
TELCO_ASSET_MGMT/
├── database/
│   ├── schema.sql              # Tables, indexes
│   ├── stored-procedures.sql   # Stored procedures
│   └── seed-data.sql           # Default data
├── backend/
│   ├── server.js               # Express entry point
│   ├── config/db.js            # SQL Server connection
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication
│   │   ├── rbac.js             # Role-based access control
│   │   └── audit.js            # Audit logging
│   ├── routes/                 # All API routes
│   │   ├── auth.js
│   │   ├── servers.js
│   │   ├── incidents.js
│   │   ├── maintenance.js
│   │   └── ... (16 route files)
│   └── utils/
│       ├── sms.js              # Hormuud SMS integration
│       ├── otp.js              # OTP generation/verification
│       └── encryption.js       # AES encryption
├── frontend/
│   ├── app/
│   │   ├── layout.js           # Root layout
│   │   ├── login/page.js       # Login page
│   │   └── (dashboard)/        # Protected routes
│   │       ├── layout.js       # Sidebar layout
│   │       ├── dashboard/      # Dashboard page
│   │       ├── servers/        # Server list, register, detail
│   │       ├── racks/          # Rack list, rack view
│   │       ├── incidents/      # Incident management
│   │       ├── maintenance/    # Maintenance scheduler
│   │       ├── engineers/      # Engineer profiles
│   │       ├── reports/        # Report generator
│   │       ├── audit-log/      # Audit trail
│   │       └── admin/          # Administration
│   ├── components/
│   │   └── layout/Sidebar.js   # Collapsible sidebar
│   ├── lib/
│   │   ├── api.js              # Axios client
│   │   ├── auth.js             # Auth context
│   │   └── utils.js            # Helpers
│   └── styles/globals.css      # Tailwind + design system
└── README.md
```
