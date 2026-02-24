# Database Setup - TELCO Asset Management

Data created in the UI is saved to the database **only when SQL Server is connected**. If you see "Demo mode" in the dashboard, data goes to memory and is lost on restart.

## 1. Create the database

Run in SQL Server Management Studio or `sqlcmd`:

```bash
# Run in order:
sqlcmd -S localhost -U sa -P yourpassword -i database/schema.sql
sqlcmd -S localhost -U sa -P yourpassword -i database/stored-procedures.sql
sqlcmd -S localhost -U sa -P yourpassword -i database/seed-data.sql
```

Or run each `.sql` file manually in SSMS (schema → stored-procedures → seed-data).

## 2. Configure the backend

Copy `backend/.env.example` to `backend/.env` and set:

```env
DB_SERVER=localhost
DB_DATABASE=TELCO_ASSET_MGMT
DB_USER=sa
DB_PASSWORD=your_password
```

**SQL Server Express** example:

```env
DB_SERVER=localhost
DB_INSTANCE=SQLEXPRESS
DB_DATABASE=TELCO_ASSET_MGMT
DB_USER=sa
DB_PASSWORD=your_password
```

**Do not set** `DEMO_MODE=1` if you want real database persistence.

## 3. Restart the backend

After changing `.env`:

```bash
cd backend
node server.js
```

You should see: `Database connected successfully`

If you see `DEMO MODE: Database unavailable`, check:

- SQL Server is running
- Server name, user, and password in `.env` are correct
- The `TELCO_ASSET_MGMT` database exists
- Firewall allows connections to port 1433 (or your instance)

## 4. Optional: No predefined users

To create all users via the API (e.g. Postman) with no seed user:

- Run `database/seed-roles-only.sql` instead of `database/seed-data.sql` (roles and permissions only, no admin user).
- Create the first user with **POST** `http://localhost:5000/api/auth/bootstrap` (see `docs/API_POSTMAN.md`).

## 5. Unlock accounts and developer user

If you see **423 (Locked)** on login (too many failed attempts):

- From the backend folder run: `npm run seed:developer`  
  This unlocks all users and creates/updates the **developer** admin user.
- Or in SSMS run `database/unlock-users.sql` to only unlock (no new user).

**Developer login** (after running `npm run seed:developer`):  
- Username: `developer`  
- Password: `Nasri123`  
- Email: nasrix01@gmail.com, full name: sys developer, OTP method: SMS  

## 6. Verify

- Open the app and log in (use the user you created via bootstrap, or the seed admin if you ran full seed).
- Confirm there is **no** "Demo mode" banner in the dashboard.
- Create a department, then run: `SELECT * FROM departments` in SSMS.
