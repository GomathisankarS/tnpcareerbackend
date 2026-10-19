# API

Base path: `/api`. Success: `{success:true,data,meta?}`. Errors: `{success:false,error:{code,message,details?},requestId}`. Validation details contain field/message pairs without submitted values. Responses include X-Request-Id. A 204 has no body.

| Method/path | Access | Purpose |
| --- | --- | --- |
| GET /health | Public | Process liveness |
| GET /health/db | Public | Database readiness |
| POST /auth/register | Trusted Origin | Required fullName, email, mobileNumber, password; creates a candidate |
| POST /auth/login | Trusted Origin | identifier (email/mobile), password, optional loginRole (candidate/admin); rejects role mismatch after password verification without issuing tokens; returns identity/accessToken and sets refresh cookie |
| POST /auth/refresh | Trusted Origin + cookie | Rotates refresh token |
| POST /auth/logout | Trusted Origin + cookie | Revokes family, clears cookie; 204 |
| GET /auth/me | Bearer | Current identity |
| GET /categories | Public | Active category id/name/slug/jobCount |
| GET /job-options | Public | Experience/work-mode/employment options |
| GET /jobs | Public | Published visible jobs, filtered and paginated |
| GET /jobs/:id | Public | API-backed job details |
| GET /admin/dashboard | Admin | Counts and recent jobs |
| GET /admin/jobs | Admin | Non-deleted jobs, including drafts/closed |
| GET /admin/jobs/:id | Admin | Editable job |
| POST /admin/jobs | Admin | Create job; 201 |
| PUT /admin/jobs/:id | Admin | Replace writable job fields |
| DELETE /admin/jobs/:id | Admin | Soft-delete; 204 |
| GET /admin/catalog/:kind | Admin | Options and usage counts |
| POST /admin/catalog/:kind | Admin | Create option; 201 |
| PUT /admin/catalog/:kind/:id | Admin | Edit label/activity/city rule |
| DELETE /admin/catalog/:kind/:id | Admin | Delete unused option; 204 |
| GET /profile | Candidate | Own profile or null |
| PUT /profile | Candidate | Save details and required/current PDF |
| POST /profile/resume | Candidate | Replace existing profile's PDF; compatibility endpoint |
| GET /profile/resume | Candidate | Download own current PDF |
| GET /applications | Candidate | Own paginated history |
| GET /applications/job/:jobId | Candidate | Own application summary or null |
| POST /applications | Candidate | Apply once; 201 or 409 ALREADY_APPLIED |
| GET /applications/:id/resume | Owner or admin | Download immutable application PDF |

## Authentication

Registration requires all four API fields. The UI also checks matching password confirmation; confirmation is never sent/stored. Password length is 10-128; passwords are not trimmed. Emails are normalized lowercase; mobile numbers use international format. Safe identity: id, fullName, email, mobileNumber, role. The database phone column is users.mobile_number.

Protected requests use `Authorization: Bearer <access token>`. Refresh cookies are HttpOnly, SameSite=Lax and Secure on HTTPS. Auth POST Origin must match FRONTEND_ORIGIN. Refresh tokens, password hashes and private storage keys are not exposed in JSON.

## Job filters and writes

List query: page (default 1), limit (default 12, max 50), q (max 100), categoryId, experienceLevel, employmentType, workMode, city, featured (`true`/`false`), sort (`latest`/`salary`). Admin additionally accepts status (`draft`/`published`/`closed`). Unknown query keys, malformed codes and invalid ranges are rejected. Valid unknown option codes produce no matches. Meta contains page, limit, total and totalPages.

Writable fields: title (1-150), companyName (1-150), categoryId, locationCity (nullable), employmentType, workMode, experienceLevel, minExperienceMonths (0-720), maxExperienceMonths (nullable, at least min), salaryMinAnnualInr/salaryMaxAnnualInr (both null or 0 <= min <= max <= 9999999999.99), description (1-10000, plain text), skills (1-30 unique strings up to 60 characters), isFeatured, status. The server owns creator, timestamps and deletion.

Business choices come from the option APIs. New jobs require active choices; an existing job may keep its current inactive choice. City requirements follow work-mode metadata. Job responses include display names alongside stable option codes.

## Managed options

Kinds: categories, experienceLevel, workMode, employmentType. Body: name, code, isActive and optional requiresCity. Codes are immutable. Category codes are hyphenated slugs (max 80); other codes match `[a-z][a-z0-9_]{0,39}`. Names are 1-80 characters.

Work-mode requiresCity accepts a boolean (default true); null is invalid. Other groups normalize it to null, including old boolean payloads. Public options return requiresCity as SQL 0/1 for work modes and null otherwise. Inactive options remain filterable for existing jobs. Inactive categories hide their jobs from public browsing.

Duplicate names/codes return 409 OPTION_EXISTS. Used choices, including those referenced by soft-deleted jobs, cannot be removed: 409 OPTION_IN_USE. Deactivate them instead.

## Profile and application

PUT /profile accepts multipart currentCity (1-100), totalExperienceMonths (0-720), skills (JSON array) and resume. First save requires a PDF; subsequent detail-only saves keep the existing file. The JSON detail-only representation is also supported when a saved resume exists.

Resumes must be valid unencrypted PDFs, at most 5 MiB. Response metadata: originalName, sizeBytes, uploadedAt. Download requires authorization. Later replacements do not change existing application snapshots.

POST /applications takes jobId and optional coverNote (null or 1-2000 trimmed characters). Candidate identity/profile/resume come from the server. History accepts page/limit only.

## Errors

400 validation/malformed JSON, 401 missing/expired identity, 403 role/origin rejection, 404 unavailable resource, 409 duplicate/conflict, 413 oversized body/upload, 429 rate limit, 500 unexpected failure, 503 readiness failure. Error responses do not include SQL, stack traces or secrets.
