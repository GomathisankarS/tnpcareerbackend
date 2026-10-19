# Database design

MySQL/InnoDB with utf8mb4 and UTC timestamps. API camelCase fields map to snake_case columns in repositories. The shared phone column is `users.mobile_number`.

## Tables

| Table | Purpose and key rules |
| --- | --- |
| users | Shared admin/candidate identity; unique normalized email/mobile; Argon2id password hash; role/activity |
| candidate_profiles | One profile per candidate; city, experience months, skills JSON and current resume metadata |
| job_categories | Category name, immutable slug, active flag; referenced by jobs |
| job_options | Experience, work-mode and employment choices; unique kind/code and kind/name; editable labels |
| jobs | Category/creator references, job fields, salary/experience ranges, skills, publication status and soft deletion |
| job_applications | Candidate/job references, cover note, status and immutable resume metadata snapshot; unique job/candidate |
| auth_sessions | Hashed refresh token generations with family, expiry, rotation and revocation timestamps |

## Units and validation

Experience is integer months, 0-720. Salary is annual INR stored as DECIMAL(12,2); provide both bounds or neither. Skills are JSON arrays of unique bounded strings. Descriptions are plain text. Nullable fields use SQL NULL, not empty placeholder strings.

Email/mobile remain nullable in the shared users schema to preserve existing/admin accounts, with a contact CHECK. Public registration requires both contacts. Resume columns are nullable for legacy data; the service requires a valid saved PDF before profile/application completion.

## Managed choices

Categories retain their original FK. Other choices use stable ASCII codes in jobs.employment_type, jobs.work_mode and jobs.experience_level, with labels resolved by lookup joins. Service transactions validate choice existence/activity and lock selected options. Because the shared lookup has a kind discriminator, these three columns are not direct option FKs; any direct SQL writer must enforce the same relationship.

Used options, including references from soft-deleted jobs, cannot be deleted. Deactivation prevents new assignments; existing jobs may retain a current inactive choice. Inactive categories hide their jobs from public queries.

requires_city is NULL for experience/employment, and 0/1 for work modes. A database CHECK enforces applicability. City requirements are validated from work-mode metadata by the API.

## Transactions and history

Account/session/profile/application mutations lock the account row before dependent records. Applying also locks/checks the open job. The unique application index remains the final duplicate guard. Transactions commit or roll back on one acquired connection and always release it.

Jobs are soft-deleted to preserve application history. Profile resumes use new immutable private files on replacement; applications copy metadata so earlier submissions retain their original file. Never remove files still referenced by a profile or application.

## Query strategy

The supplied schema defines browse, featured, category/experience, location and creator indexes for jobs; candidate/job indexes for applications; and family/user/expiry indexes for sessions. Sorting adds the job ID as a tie-breaker. Dynamic sort expressions are allowlisted and all values are bound parameters. Keyword browsing currently uses escaped LIKE matching; the baseline FULLTEXT index is retained for compatibility, not used by that query. Add indexes only after checking query plans with realistic data.

## Installation and upgrades

For a new empty database, `setup.sql` contains the current seven-table schema and a snapshot of current category/job-option rows. It excludes users, profiles, jobs, applications, sessions and resumes. Generate a fresh snapshot after editing lookups with backend `npm run db:export:setup`; the exporter is read-only against the source database. The one-file setup is already at the latest migration level.

`tnp_job_portal_schema.sql` is the original six-table baseline for a new empty database. Never reapply it over existing data.

1. Migration 001 adds job_options, maps the original enum choices into lookup rows and changes three job columns to VARCHAR while preserving their values.
2. Migration 002 makes requires_city nullable and restricts 0/1 values to work modes, preserving all other option metadata/timestamps.

Run backend `npm run db:migrate:options` explicitly. It verifies schema state, takes a migration lock, checks preservation and skips completed versions. MySQL DDL commits implicitly; back up deployed data and stop writes before upgrading. No schema work happens during API startup.

Local SQL verification used MySQL 8.0.45. The compatibility target is 8.0.44; exact-version execution is not claimed. `npm run db:inspect` reads version/table/phone-column metadata without exposing credentials or changing rows.
