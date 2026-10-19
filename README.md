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

Resume storage supports a private Supabase bucket for Render and local files for development. Configure the Supabase environment variables below before relying on production uploads. Proxy trust/rate limiting also needs validation for the final hosting chain. Uploading this source to GitHub does not deploy a live service.

## Design

Controllers translate HTTP requests; services implement business rules; repositories use parameterized MySQL queries. Authentication uses Argon2id password hashes, short-lived JWT access tokens and rotating opaque refresh tokens in HttpOnly cookies. Refresh token hashes and revocation families are persisted. Authorization checks current roles and resource ownership on the server. Applications enforce one candidate/job pair and retain a snapshot of the required profile resume. Catalog options are managed through admin APIs.

## Private Supabase resume storage


Create a private bucket named resumes with PDF-only uploads and a 5 MiB limit. Do not enable public access or public upload policies. Application users authenticate with this API; the backend accesses the bucket using its server-only legacy service_role key. No Supabase Auth accounts or change to the Aiven database are required.

In Render add STORAGE_DRIVER=supabase, SUPABASE_URL as your project HTTPS origin (no trailing slash), SUPABASE_SERVICE_ROLE_KEY as the legacy service_role key from Supabase Project Settings / API Keys, and SUPABASE_STORAGE_BUCKET=resumes. Never use an anon/publishable key for this backend adapter. Keep the service_role key out of frontend variables, Git and chat. Save and deploy the latest backend commit.

The adapter uploads validated PDFs using immutable UUID object names and no upsert. Downloads pass through existing authenticated owner/admin routes and use no-store responses; no public object URL is returned. Application snapshots keep their original key. Profile saves check that an existing remote object remains readable; provider failures return a retryable 503 rather than reporting that the user forgot a resume. Newly uploaded objects are removed if the database save fails. Older files are retained because applications may reference them.

The storage driver selects one location for all keys. Existing local uploads are not automatically copied: migrate surviving files to the bucket with their exact stored UUID filenames before switching, or candidates must upload replacement resumes. Files already lost on Render cannot be recovered from MySQL metadata. Historical application attachments require their original files; replacing a profile does not repair old attachments. No destructive database changes or migrations are required.

Verify on the live frontend: upload/save a PDF, refresh and download it, edit profile without replacing the PDF, submit an application, replace the profile PDF and confirm the earlier application downloads its original attachment. Confirm persistence after a Render redeploy. Automated storage tests simulate a private provider; they do not prove that the configured Supabase bucket/key works.
