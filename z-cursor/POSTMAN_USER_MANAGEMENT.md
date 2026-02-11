# User Management API - Postman Guide

## Prerequisites

1. **You need an Admin user first** - Either:
   - Run the SQL script `CREATE_TEST_USERS.sql` to create the initial admin user
   - OR manually insert an admin user into the database

2. **Get your JWT token** by logging in

## Step 1: Login to Get JWT Token

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@123"
}
```

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 1,
      "username": "admin",
      "roleName": "Admin"
    }
  }
}
```

**Copy the token** - you'll use it in all subsequent requests!

---

## Step 2: Get Available Roles

```http
GET http://localhost:3000/api/users/roles
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**Response:**
```json
{
  "data": {
    "roles": [
      {
        "role_id": 1,
        "role_name": "Admin",
        "description": "Full system access"
      },
      {
        "role_id": 2,
        "role_name": "TeamLead",
        "description": "Team-scoped manager"
      },
      {
        "role_id": 3,
        "role_name": "Engineer",
        "description": "Assigned servers operator"
      }
    ]
  }
}
```

---

## Step 3: Get Available Teams

```http
GET http://localhost:3000/api/teams
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**Response:**
```json
{
  "data": {
    "teams": [
      {
        "team_id": 1,
        "team_name": "Engineering Team"
      },
      {
        "team_id": 2,
        "team_name": "Operations Team"
      }
    ]
  }
}
```

---

## Step 4: Create Users

### Create Team Lead User

```http
POST http://localhost:3000/api/users
Authorization: Bearer YOUR_JWT_TOKEN_HERE
Content-Type: application/json

{
  "username": "teamlead1",
  "email": "teamlead@hormuud.com",
  "password": "TeamLead@123",
  "full_name": "Ahmed Hassan (Team Lead)",
  "role_id": 2,
  "team_id": 1
}
```

### Create Engineer User

```http
POST http://localhost:3000/api/users
Authorization: Bearer YOUR_JWT_TOKEN_HERE
Content-Type: application/json

{
  "username": "engineer1",
  "email": "engineer@hormuud.com",
  "password": "Engineer@123",
  "full_name": "Mohamed Ali (Engineer)",
  "role_id": 3,
  "team_id": 1
}
```

### Create Another Admin (Admin only)

```http
POST http://localhost:3000/api/users
Authorization: Bearer YOUR_JWT_TOKEN_HERE
Content-Type: application/json

{
  "username": "admin2",
  "email": "admin2@hormuud.com",
  "password": "Admin@456",
  "full_name": "Fatima Ahmed (Admin)",
  "role_id": 1,
  "team_id": null
}
```

**Success Response:**
```json
{
  "data": {
    "user_id": 4
  }
}
```

---

## Step 5: List All Users

```http
GET http://localhost:3000/api/users
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**Response:**
```json
{
  "data": {
    "users": [
      {
        "user_id": 1,
        "username": "admin",
        "email": "admin@hormuud.com",
        "full_name": "System Administrator",
        "role_id": 1,
        "role_name": "Admin",
        "team_id": null,
        "team_name": null,
        "is_active": true,
        "created_at": "2026-02-07T10:00:00.000Z"
      },
      {
        "user_id": 2,
        "username": "teamlead1",
        "email": "teamlead@hormuud.com",
        "full_name": "Ahmed Hassan (Team Lead)",
        "role_id": 2,
        "role_name": "TeamLead",
        "team_id": 1,
        "team_name": "Engineering Team",
        "is_active": true,
        "created_at": "2026-02-07T10:05:00.000Z"
      }
    ]
  }
}
```

---

## Step 6: Update User (Deactivate/Reactivate)

```http
PATCH http://localhost:3000/api/users/2
Authorization: Bearer YOUR_JWT_TOKEN_HERE
Content-Type: application/json

{
  "is_active": false
}
```

---

## Step 7: Delete User (Admin only)

```http
DELETE http://localhost:3000/api/users/3
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

---

## Common Errors

### 401 Unauthorized
- Token missing or expired
- Solution: Login again and get a fresh token

### 403 Forbidden
- Insufficient permissions
- TeamLead trying to create Admin users
- TeamLead trying to manage users outside their team

### 400 Bad Request
- Username already exists
- Invalid role_id or team_id
- Password too short (minimum 6 characters)

### 404 Not Found
- User not found
- Invalid user_id

---

## Testing Workflow

1. **As Admin:**
   ```bash
   Login → Create TeamLead → Create Engineer → List Users
   ```

2. **As TeamLead:**
   ```bash
   Login → Create Engineer (in their team only) → List Team Users
   ```

3. **As Engineer:**
   ```bash
   Login → Cannot access /api/users (403 Forbidden)
   ```

---

## Postman Collection Variables

Set these in your Postman environment:

| Variable | Value |
|----------|-------|
| `base_url` | `http://localhost:3000` |
| `token` | `YOUR_JWT_TOKEN_HERE` |
| `admin_role_id` | `1` |
| `teamlead_role_id` | `2` |
| `engineer_role_id` | `3` |
| `team_id` | `1` |

Then use them in requests:
```
{{base_url}}/api/users
Authorization: Bearer {{token}}
```
