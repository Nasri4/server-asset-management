# Create Users via Postman (no predefined users)

You can create users entirely via the API—no need to rely on a predefined admin user from seed.

## 1. Database setup (roles required)

Run in order in SSMS (or sqlcmd):

- `database/schema.sql`
- `database/stored-procedures.sql`
- `database/seed-data.sql` **or** `database/seed-roles-only.sql` (roles and permissions only; use seed-roles-only if you want zero predefined users)

If you removed the default admin user from seed, the `users` table will be empty. Use **bootstrap** to create the first user.

## 2. Create the first user (bootstrap)

**Only works when there are no users in the database.**

- **Method:** `POST`
- **URL:** `http://localhost:5000/api/auth/bootstrap`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**

```json
{
  "username": "your_username",
  "password": "YourPassword8chars",
  "full_name": "Your Full Name",
  "email": "you@example.com",
  "phone": "+252612345678"
}
```

- `username`, `password`, `full_name` are required.
- `password` must be at least 8 characters.
- `email` and `phone` are optional.
- The first user is assigned the highest-level role (Admin) from the `roles` table. You can pass `role_id` (e.g. `1`) to pick a different role.

**Success (201):** You can now log in with this username and password.

**403:** There is already at least one user; use the admin “Create user” flow instead (step 4).

## 3. Log in

- **Method:** `POST`
- **URL:** `http://localhost:5000/api/auth/login`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**

```json
{
  "username": "your_username",
  "password": "YourPassword8chars"
}
```

**Success (200):** Response includes `token` and `user`. Copy the `token` for the next step.

## 4. Create more users (admin only)

- **Method:** `POST`
- **URL:** `http://localhost:5000/api/admin/users`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <paste_token_from_login_here>`
- **Body (raw JSON):**

```json
{
  "username": "newuser",
  "password": "Password8chars",
  "full_name": "New User Name",
  "email": "newuser@example.com",
  "phone": null,
  "role_id": 2,
  "department_id": null,
  "team_id": null
}
```

- `username`, `password`, `full_name`, `role_id` are required.
- `role_id`: 1 = Admin, 2 = Department Head, 3 = Team Leader, 4 = Engineer, 5 = Viewer (from seed).
- `department_id` and `team_id` are optional.

**Success (201):** User created.

## Summary

| Step | Endpoint | Auth |
|------|----------|------|
| Create first user | `POST /api/auth/bootstrap` | None |
| Log in | `POST /api/auth/login` | None |
| Create more users | `POST /api/admin/users` | Bearer token (admin) |

Base URL: `http://localhost:5000` (or your `NEXT_PUBLIC_API_URL` / backend URL).
