# TNP Careers backend

Express API for the TNP Careers job portal. The React frontend is maintained and deployed separately.

## Layout

- backend/src: configuration, database pool, shared middleware and feature modules.
- backend/tests: unit/API tests and isolated database integration tests.
- backend/scripts: administrator creation, schema inspection, explicit lookup migrations and setup export.
- database: fresh installation SQL, original baseline, versioned migrations and database design.
- docs/api.md: endpoint and response contracts.

## Local setup

Use Node.js 22.14 or newer and MySQL 8.0.44 or compatible MySQL 8.0. Import database/setup.sql into a new empty database. It includes the current category and filter values; it contains no accounts or job/application data. Preserve existing databases and use the documented migrations only when required.

From backend/, run npm ci, copy .env.example to .env and configure your connection and a random JWT_SECRET locally. The phone column is users.mobile_number. Run npm run db:inspect to check connectivity, then npm run dev. Never commit .env or private uploads.

Create an administrator with npm run admin:create after supplying ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME privately in your local environment. Public registration always creates a candidate.

## Verification

From backend/, run npm test, npm run lint and npm run format:check. Database integration tests require a separate empty database ending in _test and TEST_DB_NAME; run npm run test:db only against that isolated database. Do not use the populated application database for tests.

## Render and Aiven

Create a Node web service linked to this repository. Set Root Directory to backend, Build Command to npm ci and Start Command to npm start. Render supplies PORT.

Configure NODE_ENV=production, FRONTEND_ORIGIN as the exact HTTPS frontend origin, JWT_SECRET as a new random secret of at least 32 characters, and the private Aiven DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD values. Use the Aiven DNS hostname and supplied port. Set DB_SSL=true and DB_SSL_CA_FILE=/etc/secrets/ca.pem. Add the downloaded Aiven CA certificate as a Render Secret File named ca.pem. Certificate and hostname verification remain enabled. Suggested demo pool settings: DB_CONNECTION_LIMIT=5 and DB_TIMEOUT_MS=15000.

Check /api/health and /api/health/db after deployment. Configure the separate Vercel frontend to proxy /api to the actual backend URL and provide an SPA fallback; verify cookies and origin handling end to end.

The current resume implementation uses private local files. Render free service storage is ephemeral: persistent private object storage is still required before relying on resume uploads there. Proxy trust/rate limiting also needs validation for the final hosting chain. Uploading this source to GitHub does not deploy a live service.

## Design

Controllers translate HTTP requests; services implement business rules; repositories use parameterized MySQL queries. Authentication uses Argon2id password hashes, short-lived JWT access tokens and rotating opaque refresh tokens in HttpOnly cookies. Refresh token hashes and revocation families are persisted. Authorization checks current roles and resource ownership on the server. Applications enforce one candidate/job pair and retain a snapshot of the required profile resume. Catalog options are managed through admin APIs.
