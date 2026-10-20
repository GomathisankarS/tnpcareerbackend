# Verification

Executed on 20 October 2026 after final source cleanup with Node.js 22.14.0, npm 10.9.2, MySQL 8.0.45 and Playwright Chromium.

## Results

| Check | Result |
| --- | --- |
| Backend unit/HTTP tests | 33 passed; zero failures or skipped tests |
| MySQL integration | 13 scenarios passed; 14 tests including the parent |
| Frontend component/Redux tests | 37 passed across 3 files |
| Admin/candidate browser journeys | 16 passed |
| Backend and frontend lint/formatting | Passed |
| Frontend production build | Passed |
| Comment-only source comparison | Seven modified runtime files have identical executable syntax |
| Package/lockfile dependency consistency | Passed for both packages |
| Private-value and tracked-artifact checks | Passed for both publication repositories |

## Coverage

Backend checks cover registration validation, Argon2/JWT authentication, dedicated admin/candidate login intent, role/ownership and Origin checks, refresh rotation/replay/concurrency/rollback, error redaction, readiness, transaction release and graceful shutdown. SQL scenarios cover job CRUD/filtering/visibility, dashboard aggregates, category/option CRUD and safe deactivation, required profile/PDF saving, immutable application resume snapshots, duplicate/concurrent application guards and closed/deleted job rejection.

Frontend tests cover route/navigation boundaries, Redux refresh coordination, registration validation on blur/correction, login-role requests/errors, profile/PDF persistence/download and duplicate-application feedback. Browser journeys exercise admin/candidate CRUD and application flows, eight-job pagination with filters/browser history, mobile/tablet layouts, loading/error/retry and session restoration. One browser journey deliberately injects a listing error; its retry uses the real API.

Private Supabase tests simulate immutable uploads, authorized backend download behavior, replacements, cleanup, missing files, provider/network failures, bounded downloads and configuration validation. These tests do not authenticate against the user's real Supabase bucket.

## Isolation

SQL and browser tests ran against a new disposable MySQL instance at 127.0.0.1:13307 under workspace scratch. SQL used tnp_cleanup_20261020_test; browser tests generated and removed tnp_browser_*_test databases with synthetic credentials. Test API/frontend ports were 14000 and 15173. Existing development and hosted database records, credentials and resumes were not changed by these tests.

## Cleanup

Removed the one-off schema inspection and SQL snapshot-export utilities, their package commands and stale documentation references. Kept admin creation and versioned migrations for setup/upgrades, the fresh-install SQL with lookup values, and guarded fixture scripts required by automated tests. Removed redundant backend section comments and verbose comments that repeated function names. Kept concurrency/security explanations, mutation error-handling comments and operational logs. Frontend source had no debug logging or temporary data scripts to remove.

## Limits

Exact MySQL 8.0.44, Safari/Firefox, formal accessibility, production load tests and penetration testing were not run. Local Chromium results are not a complete hosted end-to-end certification. Real cloud resume persistence must be checked through an authenticated upload/download and Render redeployment. Existing local files are not automatically migrated to Supabase. Refresh coordination is per tab and rate limiting is process-local. Existing Vitest development-tool audit findings remain documented in the frontend repository; dependency versions were not changed during cleanup.

The fresh-install database/setup.sql retains the schema and lookup snapshot verified on 19 October 2026. It is not a dump of accounts, jobs, applications or resume data. Use it only in a new empty database; existing installations use the versioned migrations.
