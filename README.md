# TNP Careers — Complete Local Setup

TNP Careers is a job portal with separate candidate and administrator workspaces. The frontend uses React, Redux Toolkit and RTK Query; the backend uses Node.js, Express and MySQL.

This guide sets up **both applications locally** using local MySQL and private local resume storage. Render, Vercel, Aiven and Supabase accounts are not needed for this setup.

## 1. Install the prerequisites

| Tool | Version / purpose |
| --- | --- |
| Node.js | 22.x, version 22.14.0 or newer within that major version |
| npm | Included with Node.js; verification used npm 10.9.2 |
| MySQL Server | 8.0.44 or compatible MySQL 8.0; verification used 8.0.45 |
| MySQL Workbench | To import the SQL file and manage local users |
| Git | To clone both repositories |

Start your local MySQL service. Keep its administrator username and password available for database setup.

Check Node, npm and Git in a new terminal:

```powershell
node --version
npm --version
git --version
```

The shell examples below use **Windows PowerShell**. Run commands from the folder named above each command block.

## 2. Download both repositories

Choose a parent folder for the project, then run:

```powershell
mkdir tnp-careers
cd tnp-careers
git clone https://github.com/GomathisankarS/tnpcareerbackend.git
git clone https://github.com/GomathisankarS/tnpcareerfrontend.git
```

If the repositories are private, sign in to GitHub with an account that has access.

The relevant folders will be:

```text
tnp-careers/
  tnpcareerbackend/
    backend/
      src/
      scripts/
      tests/
      .env.example
      package.json
    database/
      setup.sql
      migrations/
    docs/
  tnpcareerfrontend/
    frontend/
      src/
      e2e/
      .env.example
      package.json
      vite.config.js
      vercel.json
    docs/
```

**The applications are inside the inner `backend/` and `frontend/` folders. Run npm commands there, not at the repository roots.**

If you received the combined project folder instead, use its existing `backend/`, `frontend/` and `database/` directories. Skip cloning; the remaining configuration and commands are the same inside those application folders.

## 3. Create and import the local database

These steps are for a **new, empty local database**. Do not import `setup.sql` over an existing database with data.

1. Open MySQL Workbench and connect to your local MySQL server using your database administrator account.
2. Open a SQL tab and run:

   ```sql
   CREATE DATABASE tnp_job_portal
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_0900_ai_ci;
   USE tnp_job_portal;
   ```

3. In the Schemas panel, refresh and double-click `tnp_job_portal` to make it the default schema.
4. Open **File → Open SQL Script** and select:

   ```text
   tnp-careers/tnpcareerbackend/database/setup.sql
   ```

5. Execute the complete script using the button for **all statements**, not only the current statement.
6. Confirm the import in a SQL tab:

   ```sql
   USE tnp_job_portal;
   SHOW TABLES;
   SELECT COUNT(*) AS categories FROM job_categories;
   SELECT COUNT(*) AS options FROM job_options;
   ```

The setup creates seven tables: `users`, `candidate_profiles`, `job_categories`, `job_options`, `jobs`, `job_applications` and `auth_sessions`. It includes default category and filter-option values. It does not create accounts, jobs, applications or resumes.

The contact column is **`users.mobile_number`**.

### Create a local application database user

Using the database administrator connection in Workbench, run the following after replacing the password with your own local password:

```sql
CREATE USER 'tnp_app'@'localhost'
  IDENTIFIED BY 'choose-your-own-local-db-password';

GRANT SELECT, INSERT, UPDATE, DELETE
  ON tnp_job_portal.*
  TO 'tnp_app'@'localhost';
```

If this database user already exists, use its existing password and grant it the permissions above. The backend uses this account; Workbench's administrator account remains available for importing schema and changing a user's role.

### If you already have a project database

Preserve the existing tables and data. Point the backend environment at that database. Older installations that predate managed job options can use `npm run db:migrate:options` with a database account that has the required schema permissions. Review the versioned SQL files first. A fresh import of `setup.sql` does not need this migration command.

## 4. Install backend dependencies

From `tnp-careers/`:

```powershell
cd tnpcareerbackend/backend
npm ci
```

Keep `package-lock.json`; `npm ci` installs the locked dependency versions.

## 5. Configure the backend environment

While inside `tnpcareerbackend/backend/`, create your local environment file:

```powershell
Copy-Item .env.example .env
```

Skip this copy if you already have a configured `.env`; copying again can overwrite your settings.

**The backend environment file belongs at `tnpcareerbackend/backend/.env`, alongside its `package.json`.** Do not place it in `src/`, the outer repository folder or the frontend folder.

Generate a new JWT secret locally:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy the generated output into `JWT_SECRET`. Keep it private.

Edit `backend/.env` with the settings below. Replace the database password and JWT placeholder before starting the backend:

```dotenv
NODE_ENV=development
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_NAME=tnp_job_portal
DB_USER=tnp_app
DB_PASSWORD="your-local-application-db-password"
DB_SSL=false
DB_SSL_CA_FILE=
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=50
DB_TIMEOUT_MS=5000

JWT_SECRET=replace_with_your_generated_secret
JWT_ISSUER=tnp-api
JWT_AUDIENCE=tnp-web
ACCESS_TTL_SECONDS=900
REFRESH_TTL_SECONDS=604800
AUTH_RATE_LIMIT=30

STORAGE_DRIVER=local
UPLOAD_DIR=private-uploads
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=resumes

TEST_DB_NAME=tnp_job_portal_test
```

| Setting | What to enter |
| --- | --- |
| `DB_PORT` | Your actual local MySQL port, usually `3306` |
| `DB_NAME` | The database where you imported `setup.sql` |
| `DB_USER` / `DB_PASSWORD` | The local application database user's credentials |
| `JWT_SECRET` | The generated random secret, at least 32 characters; do not leave the placeholder |
| `FRONTEND_ORIGIN` | Exactly `http://localhost:5173`, without a trailing slash |
| `STORAGE_DRIVER` | `local` for this local setup |
| `UPLOAD_DIR` | Relative paths resolve from the inner backend folder |

With `STORAGE_DRIVER=local`, resumes are saved privately under `backend/private-uploads/`. This folder is created when needed; uploads persist locally as long as you retain it. Supabase settings may remain blank. `TEST_DB_NAME` is only for optional database tests, not normal application startup.

Do not commit `.env`, credentials or uploaded resumes. Restart the backend after changing its environment settings.

## 6. Start the backend

In **Terminal 1**, inside `tnpcareerbackend/backend/`:

```powershell
npm run dev
```

Leave the terminal running. Node watch mode restarts the server when source files change. You can instead use `npm start` to run without watch mode.

Open these URLs:

- [API health](http://localhost:4000/api/health) — should report `healthy`.
- [Database health](http://localhost:4000/api/health/db) — should report `database: connected`.

A successful API health check alone does not prove that MySQL is connected; check both endpoints. The backend root URL `/` is not a web page.

## 7. Install and configure the frontend

Open **Terminal 2**. From `tnp-careers/`:

```powershell
cd tnpcareerfrontend/frontend
npm ci
Copy-Item .env.example .env
```

Skip the copy if a configured frontend `.env` already exists.

The frontend environment file belongs at **`tnpcareerfrontend/frontend/.env`**, alongside its `package.json`. Its contents should be:

```dotenv
VITE_API_URL=/api
```

No database credentials, JWT secret or Supabase service-role key belong in this file. Vite exposes `VITE_` variables to the browser.

Local API requests go through Vite's `/api` proxy to `http://localhost:4000`. Keep `VITE_API_URL=/api` for this setup. Restart Vite after changing frontend environment variables.

## 8. Start the frontend

Still in **Terminal 2**, inside `tnpcareerfrontend/frontend/`:

```powershell
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)**. Keep both terminals running.

Use `localhost` in the browser, matching `FRONTEND_ORIGIN`; do not switch between `localhost` and `127.0.0.1` during login testing.

| Page | Local URL |
| --- | --- |
| Home | `http://localhost:5173/` |
| Candidate registration | `http://localhost:5173/register` |
| Candidate login | `http://localhost:5173/login` |
| Browse jobs | `http://localhost:5173/jobs` |
| Candidate profile | `http://localhost:5173/profile` |
| Admin login | `http://localhost:5173/admin/login` |
| Admin dashboard | `http://localhost:5173/admin` |
| Admin manage jobs | `http://localhost:5173/admin/jobs` |
| Admin categories/filter options | `http://localhost:5173/admin/options` |

Protected pages require the appropriate signed-in role.

## 9. Create an administrator — important

> **Register through the normal registration page first. Registration always creates a candidate. Then use MySQL Workbench to change that specific user's `role` in the `users` table from `candidate` to `admin`. Finally, sign in through the dedicated admin login page.**

Follow these steps:

1. Open `http://localhost:5173/register`.
2. Fill in every field: full name, email, international mobile number, password and password confirmation. Use a password of at least 10 characters and a mobile number with its country code, such as `+91…`.
3. Submit registration. You do not need to complete a candidate profile or upload a resume to make this account an admin.
4. In Workbench, open the **same database configured in backend `.env`**.
5. Find the account in `users`, confirm its email/ID, change `role` from `candidate` to `admin`, and apply the edit.

Alternatively, use SQL. Replace the example email with the email you just registered:

```sql
USE tnp_job_portal;

SET @admin_email = 'your-registered-email@example.com';
SET @admin_id = (
  SELECT id FROM users WHERE email = @admin_email
);

SELECT id, full_name, email, role
FROM users
WHERE id = @admin_id;

UPDATE users
SET role = 'admin'
WHERE id = @admin_id AND role = 'candidate';

SELECT id, full_name, email, role
FROM users
WHERE id = @admin_id;
```

Confirm that the final result identifies the intended account and shows `role = admin`. If no row appears, check the email and selected database before continuing. Do not change `password_hash` or promote every row in the table.

6. If this account was signed in as a candidate, sign out.
7. Open **`http://localhost:5173/admin/login`** and sign in with the same email/mobile number and password.

Admin credentials are rejected on candidate login; candidate credentials are rejected on admin login. There is no public registration option that grants an admin role.

For scripted setup, the backend also retains `npm run admin:create`, which creates a new administrator from private `ADMIN_EMAIL`, `ADMIN_PASSWORD` and optional `ADMIN_NAME` environment settings. It does not overwrite an existing account. The registration-and-role-change steps above are sufficient for manual setup.

## 10. Add jobs and test the candidate flow

A fresh database contains lookup options but no jobs, so an empty home/listing is expected initially.

1. Sign in as admin and open **Manage Options** to review categories, experience levels, work modes and employment types.
2. Open **Manage Jobs** and create a job using active options.
3. Set its status to **Published** so candidates can see it. Draft and closed jobs are not shown in public listings.
4. Sign out. Register a separate account and leave its role as `candidate`.
5. Sign in at `/login`, save the candidate profile with a valid, unencrypted PDF resume up to **5 MiB**, then open a published job and apply.
6. Refresh the profile and download the resume to confirm persistence. Check application history and verify that a second application to the same job is blocked.

Candidate listings and admin job lists default to **8 jobs per page**. To see a second public page, create at least 9 published jobs that match the current filters and belong to active categories. Changing a filter resets the listing to page 1.

## 11. Run the checks

Normal unit tests do not require an application database connection.

From `tnpcareerbackend/backend/`:

```powershell
npm test
npm run lint
npm run format:check
```

From `tnpcareerfrontend/frontend/`:

```powershell
npm test
npm run lint
npm run format:check
npm run build
```

The frontend build creates `frontend/dist/`. `npm run dev` is the local full-stack development workflow; `npm run preview` alone does not provide the development API proxy.

### Optional SQL integration tests

Create a separate **empty** database named `tnp_job_portal_test`. Do not import `setup.sql` into this test database; the integration suite creates and removes its own tables. Set `TEST_DB_NAME` to that name in backend `.env`, then run `npm run test:db` from the backend folder. The configured database account needs permission to create/drop/alter tables in this isolated database; the normal runtime-only grants above are insufficient for this test command.

Never use the populated application database for integration tests. The suite rejects non-test/populated targets. Use an isolated MySQL instance for automated testing when possible.

### Optional browser tests

Playwright tests require Chromium and a disposable MySQL instance. Their default connection is `127.0.0.1:13307`, user `root`, empty password; configure a separate test instance, not your development database. Override with `E2E_DB_HOST`, `E2E_DB_PORT`, `E2E_DB_USER` and `E2E_DB_PASSWORD` in the test terminal if needed.

The runner expects a `backend/` folder alongside the inner `frontend/` folder. This already exists in the combined project. With the two-clone layout above, create a local directory junction once, from `tnp-careers/`:

```powershell
$backendPath = (Resolve-Path .\tnpcareerbackend\backend).Path
New-Item -ItemType Junction -Path .\tnpcareerfrontend\backend -Target $backendPath
```

Do not create the junction if that path already exists. It is only for local browser tests and is ignored by the frontend repository. The backend dependencies must already be installed.

From `tnpcareerfrontend/frontend/`, with the disposable MySQL instance running:

```powershell
npx playwright install chromium
$env:E2E_FRONTEND_ORIGIN='http://localhost:15173'
$env:E2E_FRONTEND_COMMAND='npm run dev -- --port 15173'
$env:STORAGE_DRIVER='local'
$env:DB_SSL='false'
npm run test:e2e
```

The runner starts its own API on port 14000 and frontend on 15173 and creates a randomly named temporary test database. Do not start another test API on those ports. Test credentials are generated; existing accounts are not needed. See [verification results](docs/verification.md) for executed checks and limits.

## 12. Troubleshooting

| Problem | Check |
| --- | --- |
| `npm ci` cannot find a lockfile | Run it inside the inner `backend/` or `frontend/` folder |
| API health works, database health fails | Start MySQL; check host, port, database name, user, password and permissions in backend `.env` |
| Missing environment variables | Ensure the filename is `.env`, not `.env.txt`, and it is beside backend `package.json` |
| JWT secret error | Generate a fresh secret, replace the placeholder and restart the backend |
| HTTPS required during local startup | Use `NODE_ENV=development` and `FRONTEND_ORIGIN=http://localhost:5173` |
| `UNTRUSTED_ORIGIN` during local login | Use exactly `http://localhost:5173` in the browser and backend setting, without a trailing slash |
| Port 4000 or 5173 already in use | Stop the other process or existing project terminal, then restart; Vite uses a strict port |
| Empty job list | Create a published job in an active category and clear filters |
| No pagination buttons | At least 9 matching jobs are needed with the default 8-job page size |
| Wrong login portal message | Candidates use `/login`; administrators use `/admin/login` |
| Role edit has no effect | Check the database selected in `.env`, verify the intended user row, sign out and sign in again |
| Profile cannot be saved | Complete the required fields and attach a valid PDF, unless a saved resume already exists |
| Resume unavailable locally | Keep `STORAGE_DRIVER=local` and the original `private-uploads/` folder; MySQL stores metadata, not the PDF bytes |
| Local frontend unexpectedly calls the hosted API | Keep frontend `VITE_API_URL=/api` and restart Vite |

If you change backend port 4000, set `API_PROXY_TARGET` in the frontend terminal before starting Vite, for example `$env:API_PROXY_TARGET='http://localhost:4100'`. If you change the frontend port, also update backend `FRONTEND_ORIGIN` to the actual browser origin and restart the backend. `API_PROXY_TARGET` is read from the process environment; it is not a `VITE_` browser variable.

## 13. Local settings versus deployment settings

| Setting | Local setup | Deployed setup |
| --- | --- | --- |
| Backend environment | Inner `backend/.env` | Render environment settings |
| `NODE_ENV` | `development` | `production` |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Exact HTTPS Vercel frontend origin |
| MySQL | Local MySQL | Aiven connection settings with verified TLS |
| `DB_SSL` | `false` for the local setup above | `true`, with Aiven's CA file configured |
| Resume storage | `local`, private filesystem folder | `supabase`, private bucket and backend-only service-role key |
| Frontend API base | `/api`, proxied by Vite | `/api`, forwarded by `frontend/vercel.json` |

Changing a local `.env` does not update Render or Vercel. Keep local and hosted configurations separate. The existing `vercel.json` does not change Vite's local development proxy. Old local resume files are not automatically copied when switching storage drivers.

## Features and project structure

| Requirement | Implementation |
| --- | --- |
| Separate admin/candidate functionality | Dedicated login pages, navigation guards and server-side role authorization |
| Dashboard and job CRUD | API-backed aggregates, shared create/edit job form, filters, soft deletion and pagination |
| Access/refresh tokens | JWT access token in Redux memory; rotating HttpOnly refresh cookie |
| Redux for data and CRUD | Shared RTK Query API with feature endpoints and cache invalidation |
| Candidate pages | Home, filtered job search, details, profile, PDF resume and application history |
| Reusable components | Shared forms, filters, cards, pagination, dialogs and loading/error states |
| Validation and responsive UI | Client/server validation, field errors and mobile/tablet layouts |

Backend features follow routes/controllers, services and parameterized SQL repositories. Frontend pages use feature hooks and shared UI components. Admin options are stored in MySQL; no demo-data creation runs at application startup. Fresh installations use `database/setup.sql`; existing installations retain explicit migration history.
