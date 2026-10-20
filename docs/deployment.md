# Vercel, Render and Aiven

Deploy the frontend repository to Vercel and the backend repository to Render. Each repository retains its frontend/ or backend/ package directory. Database setup is separate from application deployment. Never upload .env, credentials, private resumes or node_modules.

## Aiven database

Import database/setup.sql into a new empty Aiven application database. It includes the schema and current lookup values, not accounts/jobs/applications. Check the cloud MySQL version and confirm seven tables before continuing.

Download the service's CA certificate from Aiven. Use the DNS hostname and port in its connection information, not a resolved IP or assumed 3306. In MySQL Workbench, enable CA/identity verification and select the downloaded certificate.

## Backend TLS settings

The shared database connection options are used by the API pool, admin creation and migrations. DB_SSL defaults to false for local MySQL. Enabling TLS requires a valid PEM CA file and preserves certificate/hostname verification.

For a local cloud-connection test, keep the certificate under ignored backend/certs/ca.pem and provide these settings privately in the process environment or local .env:

```dotenv
DB_HOST=your-aiven-dns-hostname
DB_PORT=your-aiven-port
DB_NAME=tnp_job_portal
DB_USER=your-aiven-user
DB_PASSWORD=your-aiven-password
DB_SSL=true
DB_SSL_CA_FILE=certs/ca.pem
```

Use separate local/cloud configurations to avoid accidentally changing your development database. Run the backend and check /api/health/db for database readiness. Create a separate cloud admin with npm run admin:create and private ADMIN_EMAIL/ADMIN_PASSWORD settings. Do not run test:db against the populated cloud application database.

## Render backend

Select a Node web service from the repository, with root directory backend, build command npm ci and start command npm start. Let Render provide PORT. Add a Secret File named ca.pem containing the downloaded CA certificate; its path is /etc/secrets/ca.pem.

Configure these environment variables in Render, not in Git:

| Variable | Value |
| --- | --- |
| NODE_ENV | production |
| FRONTEND_ORIGIN | Exact HTTPS Vercel application origin, without trailing slash |
| DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD | Aiven connection details |
| DB_SSL | true |
| DB_SSL_CA_FILE | /etc/secrets/ca.pem |
| DB_CONNECTION_LIMIT | 5 for the demo |
| DB_TIMEOUT_MS | 15000 for a remote database |
| JWT_SECRET | A new random secret of at least 32 characters |

Check /api/health and /api/health/db after configuration. Successful Workbench access does not prove that Render can connect; verify it from the deployed service.

## Remaining deployment steps

- Backend source: https://github.com/GomathisankarS/tnpcareerbackend; frontend source: https://github.com/GomathisankarS/tnpcareerfrontend.
- frontend/vercel.json configures Vercel's /api rewrite to the Render URL and an SPA fallback. Keep the browser API base as /api so refresh cookies use the frontend origin. Validate auth, cookies and Origin forwarding after deployment.
- Configure proxy trust/rate-limiter behavior for the verified hosting chain; do not blindly trust arbitrary forwarded IP headers.
- Configure the private Supabase storage adapter below before relying on production resume uploads.
- Test registration/login/refresh/logout, admin mutations, candidate applications and PDF upload/download against the hosted services. Do not call the site deployed until those checks pass.

Provider documentation:

- [Render Express deployment](https://render.com/docs/deploy-node-express-app)
- [Render secret files/environment](https://render.com/docs/configure-environment-variables)
- [Aiven TLS certificates](https://aiven.io/docs/platform/concepts/tls-ssl-certificates)
- [Vercel rewrites](https://vercel.com/docs/routing/rewrites)


## Private Supabase resume storage

Create a private bucket named resumes with PDF-only uploads and a 5 MiB limit. Do not enable public access or public upload policies. Application users authenticate with this API; the backend accesses the bucket using its server-only legacy service_role key. No Supabase Auth accounts or change to the Aiven database are required.

In Render add STORAGE_DRIVER=supabase, SUPABASE_URL as your project HTTPS origin (no trailing slash), SUPABASE_SERVICE_ROLE_KEY as the legacy service_role key from Supabase Project Settings / API Keys, and SUPABASE_STORAGE_BUCKET=resumes. Never use an anon/publishable key for this backend adapter. Keep the service_role key out of frontend variables, Git and chat. Save and deploy the latest backend commit.

The adapter uploads validated PDFs using immutable UUID object names and no upsert. Downloads pass through existing authenticated owner/admin routes and use no-store responses; no public object URL is returned. Application snapshots keep their original key. Profile saves check that an existing remote object remains readable; provider failures return a retryable 503 rather than reporting that the user forgot a resume. Newly uploaded objects are removed if the database save fails. Older files are retained because applications may reference them.

The storage driver selects one location for all keys. Existing local uploads are not automatically copied: migrate surviving files to the bucket with their exact stored UUID filenames before switching, or candidates must upload replacement resumes. Files already lost on Render cannot be recovered from MySQL metadata. Historical application attachments require their original files; replacing a profile does not repair old attachments. No destructive database changes or migrations are required.

Verify on the live frontend: upload/save a PDF, refresh and download it, edit profile without replacing the PDF, submit an application, replace the profile PDF and confirm the earlier application downloads its original attachment. Confirm persistence after a Render redeploy. Automated storage tests simulate a private provider; they do not prove that the configured Supabase bucket/key works.
