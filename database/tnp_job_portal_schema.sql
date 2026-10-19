-- TNP Job Portal: initial schema, MySQL 8.0.44 compatible / InnoDB.
-- Naming revision: 16 October 2026; users.mobile_number.
-- Apply once to a NEW selected database; this file never drops existing data.
-- Database creation and application-user grants belong in environment setup.
-- Current installations also apply migrations/001_managed_job_options.sql explicitly
-- using backend npm run db:migrate:options. This baseline remains the original six tables.
-- Example: mysql --database=tnp_job_portal < tnp_job_portal_schema.sql
-- All application pool connections must also use UTC and strict SQL mode.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET SESSION time_zone = '+00:00';

-- Shared admin and candidate accounts.
CREATE TABLE `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `mobile_number` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `password_hash` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `role` ENUM('admin','candidate') NOT NULL DEFAULT 'candidate',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_mobile` (`mobile_number`),
  CONSTRAINT `ck_users_contact` CHECK (email IS NOT NULL OR mobile_number IS NOT NULL),
  CONSTRAINT `ck_users_name` CHECK (CHAR_LENGTH(TRIM(full_name)) BETWEEN 1 AND 100),
  CONSTRAINT `ck_users_email` CHECK (email IS NULL OR (CHAR_LENGTH(TRIM(email)) >= 3 AND CHAR_LENGTH(email) = CHAR_LENGTH(TRIM(email)))),
  CONSTRAINT `ck_users_mobile` CHECK (mobile_number IS NULL OR REGEXP_LIKE(mobile_number, '^[+][1-9][0-9]{1,14}$', 'c')),
  CONSTRAINT `ck_users_active` CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One saved professional profile per candidate; created when the candidate saves profile details.
CREATE TABLE `candidate_profiles` (
  `user_id` INT UNSIGNED NOT NULL,
  `current_city` VARCHAR(100) NOT NULL,
  `total_experience_months` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `skills` JSON NOT NULL,
  `resume_storage_key` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `resume_original_name` VARCHAR(255) NULL,
  `resume_size_bytes` INT UNSIGNED NULL,
  `resume_uploaded_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_profiles_city` CHECK (CHAR_LENGTH(TRIM(current_city)) BETWEEN 1 AND 100),
  CONSTRAINT `ck_profiles_experience` CHECK (total_experience_months <= 720),
  CONSTRAINT `ck_profiles_skills` CHECK (JSON_SCHEMA_VALID('{"type":"array","items":{"type":"string","minLength":1,"maxLength":60},"minItems":1,"maxItems":30,"uniqueItems":true}', skills)),
  CONSTRAINT `ck_profiles_resume_complete` CHECK ((resume_storage_key IS NULL AND resume_original_name IS NULL AND resume_size_bytes IS NULL AND resume_uploaded_at IS NULL) OR (resume_storage_key IS NOT NULL AND resume_original_name IS NOT NULL AND resume_size_bytes IS NOT NULL AND resume_uploaded_at IS NOT NULL)),
  CONSTRAINT `ck_profiles_resume_size` CHECK (resume_size_bytes IS NULL OR resume_size_bytes BETWEEN 1 AND 5242880),
  CONSTRAINT `ck_profiles_resume_names` CHECK (resume_storage_key IS NULL OR (CHAR_LENGTH(TRIM(resume_storage_key)) > 0 AND CHAR_LENGTH(TRIM(resume_original_name)) > 0))
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seeded category master for job classification and filtering.
CREATE TABLE `job_categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL,
  `slug` VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`),
  UNIQUE KEY `uq_categories_slug` (`slug`),
  CONSTRAINT `ck_categories_name` CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 80),
  CONSTRAINT `ck_categories_slug` CHECK (REGEXP_LIKE(slug, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
  CONSTRAINT `ck_categories_active` CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Admin-created job postings and their company information.
CREATE TABLE `jobs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` INT UNSIGNED NOT NULL,
  `created_by` INT UNSIGNED NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `company_name` VARCHAR(150) NOT NULL,
  `location_city` VARCHAR(100) NULL,
  `employment_type` ENUM('full_time','part_time','contract','internship') NOT NULL DEFAULT 'full_time',
  `work_mode` ENUM('onsite','hybrid','remote') NOT NULL DEFAULT 'onsite',
  `experience_level` ENUM('fresher','junior','mid','senior') NOT NULL,
  `min_experience_months` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `max_experience_months` SMALLINT UNSIGNED NULL,
  `salary_min_annual_inr` DECIMAL(12,2) NULL,
  `salary_max_annual_inr` DECIMAL(12,2) NULL,
  `description` TEXT NOT NULL,
  `skills` JSON NOT NULL,
  `is_featured` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` ENUM('draft','published','closed') NOT NULL DEFAULT 'draft',
  `published_at` DATETIME(6) NULL,
  `deleted_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ix_jobs_browse` (`status`, `deleted_at`, `published_at` DESC, `id` DESC),
  KEY `ix_jobs_featured` (`is_featured`, `status`, `deleted_at`, `published_at` DESC, `id` DESC),
  KEY `ix_jobs_category_experience` (`category_id`, `experience_level`, `status`, `deleted_at`, `published_at` DESC, `id` DESC),
  KEY `ix_jobs_location` (`location_city`, `status`, `deleted_at`, `published_at` DESC, `id` DESC),
  KEY `ix_jobs_creator` (`created_by`),
  FULLTEXT KEY `ft_jobs_keyword` (`title`, `company_name`, `description`),
  CONSTRAINT `fk_jobs_category` FOREIGN KEY (`category_id`) REFERENCES `job_categories` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_jobs_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_jobs_title` CHECK (CHAR_LENGTH(TRIM(title)) BETWEEN 1 AND 150),
  CONSTRAINT `ck_jobs_company` CHECK (CHAR_LENGTH(TRIM(company_name)) BETWEEN 1 AND 150),
  CONSTRAINT `ck_jobs_location` CHECK ((work_mode = 'remote' OR location_city IS NOT NULL) AND (location_city IS NULL OR CHAR_LENGTH(TRIM(location_city)) BETWEEN 1 AND 100)),
  CONSTRAINT `ck_jobs_experience` CHECK (min_experience_months <= 720 AND (max_experience_months IS NULL OR (max_experience_months BETWEEN min_experience_months AND 720))),
  CONSTRAINT `ck_jobs_salary` CHECK ((salary_min_annual_inr IS NULL AND salary_max_annual_inr IS NULL) OR (salary_min_annual_inr IS NOT NULL AND salary_max_annual_inr IS NOT NULL AND salary_min_annual_inr >= 0 AND salary_max_annual_inr >= salary_min_annual_inr)),
  CONSTRAINT `ck_jobs_description` CHECK (CHAR_LENGTH(TRIM(description)) BETWEEN 1 AND 10000),
  CONSTRAINT `ck_jobs_skills` CHECK (JSON_SCHEMA_VALID('{"type":"array","items":{"type":"string","minLength":1,"maxLength":60},"minItems":1,"maxItems":30,"uniqueItems":true}', skills)),
  CONSTRAINT `ck_jobs_featured` CHECK (is_featured IN (0,1)),
  CONSTRAINT `ck_jobs_published` CHECK (status = 'draft' OR published_at IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One candidate application per job, including the resume used when applying.
CREATE TABLE `job_applications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `job_id` INT UNSIGNED NOT NULL,
  `candidate_id` INT UNSIGNED NOT NULL,
  `cover_note` TEXT NULL,
  `status` ENUM('submitted','reviewed','shortlisted','rejected') NOT NULL DEFAULT 'submitted',
  `resume_storage_key` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `resume_original_name` VARCHAR(255) NULL,
  `resume_size_bytes` INT UNSIGNED NULL,
  `resume_uploaded_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_applications_job_candidate` (`job_id`, `candidate_id`),
  KEY `ix_applications_candidate` (`candidate_id`, `created_at` DESC, `id` DESC),
  KEY `ix_applications_job` (`job_id`, `created_at` DESC, `id` DESC),
  CONSTRAINT `fk_applications_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_applications_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidate_profiles` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_applications_note` CHECK (cover_note IS NULL OR CHAR_LENGTH(TRIM(cover_note)) BETWEEN 1 AND 2000),
  CONSTRAINT `ck_applications_resume_complete` CHECK ((resume_storage_key IS NULL AND resume_original_name IS NULL AND resume_size_bytes IS NULL AND resume_uploaded_at IS NULL) OR (resume_storage_key IS NOT NULL AND resume_original_name IS NOT NULL AND resume_size_bytes IS NOT NULL AND resume_uploaded_at IS NOT NULL)),
  CONSTRAINT `ck_applications_resume_size` CHECK (resume_size_bytes IS NULL OR resume_size_bytes BETWEEN 1 AND 5242880),
  CONSTRAINT `ck_applications_resume_names` CHECK (resume_storage_key IS NULL OR (CHAR_LENGTH(TRIM(resume_storage_key)) > 0 AND CHAR_LENGTH(TRIM(resume_original_name)) > 0))
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One record per issued refresh token; family_id groups rotation history for one login session.
CREATE TABLE `auth_sessions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `family_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `refresh_token_hash` BINARY(32) NOT NULL,
  `expires_at` DATETIME(6) NOT NULL,
  `rotated_at` DATETIME(6) NULL,
  `revoked_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_refresh_hash` (`refresh_token_hash`),
  KEY `ix_auth_family` (`family_id`, `revoked_at`),
  KEY `ix_auth_user` (`user_id`, `revoked_at`, `expires_at`),
  KEY `ix_auth_expiry` (`expires_at`),
  CONSTRAINT `fk_auth_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_auth_family` CHECK (REGEXP_LIKE(family_id, '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$', 'c')),
  CONSTRAINT `ck_auth_expiry` CHECK (expires_at > created_at),
  CONSTRAINT `ck_auth_rotated` CHECK (rotated_at IS NULL OR (rotated_at >= created_at AND rotated_at < expires_at)),
  CONSTRAINT `ck_auth_revoked` CHECK (revoked_at IS NULL OR revoked_at >= created_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
