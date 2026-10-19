-- TNP Careers: fresh database schema with a snapshot of current lookup values.
-- Generated: 2026-10-18T18:54:50.035Z. MySQL 8.0.44+ compatible; verified on 8.0.45.
-- Select a NEW EMPTY database before running. Never import over an existing installation.
-- No accounts, jobs, applications, sessions, credentials or resume data are included.
-- Existing installations use the versioned migrations instead.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET SESSION time_zone = '+00:00';

CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(254) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `mobile_number` varchar(16) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `password_hash` varchar(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `role` enum('admin','candidate') NOT NULL DEFAULT 'candidate',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_mobile` (`mobile_number`),
  CONSTRAINT `ck_users_active` CHECK ((`is_active` in (0,1))),
  CONSTRAINT `ck_users_contact` CHECK (((`email` is not null) or (`mobile_number` is not null))),
  CONSTRAINT `ck_users_email` CHECK (((`email` is null) or ((char_length(trim(`email`)) >= 3) and (char_length(`email`) = char_length(trim(`email`)))))),
  CONSTRAINT `ck_users_mobile` CHECK (((`mobile_number` is null) or regexp_like(`mobile_number`,_utf8mb4'^[+][1-9][0-9]{1,14}$',_utf8mb4'c'))),
  CONSTRAINT `ck_users_name` CHECK ((char_length(trim(`full_name`)) between 1 and 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `candidate_profiles` (
  `user_id` int unsigned NOT NULL,
  `current_city` varchar(100) NOT NULL,
  `total_experience_months` smallint unsigned NOT NULL DEFAULT '0',
  `skills` json NOT NULL,
  `resume_storage_key` varchar(255) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `resume_original_name` varchar(255) DEFAULT NULL,
  `resume_size_bytes` int unsigned DEFAULT NULL,
  `resume_uploaded_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_profiles_city` CHECK ((char_length(trim(`current_city`)) between 1 and 100)),
  CONSTRAINT `ck_profiles_experience` CHECK ((`total_experience_months` <= 720)),
  CONSTRAINT `ck_profiles_resume_complete` CHECK ((((`resume_storage_key` is null) and (`resume_original_name` is null) and (`resume_size_bytes` is null) and (`resume_uploaded_at` is null)) or ((`resume_storage_key` is not null) and (`resume_original_name` is not null) and (`resume_size_bytes` is not null) and (`resume_uploaded_at` is not null)))),
  CONSTRAINT `ck_profiles_resume_names` CHECK (((`resume_storage_key` is null) or ((char_length(trim(`resume_storage_key`)) > 0) and (char_length(trim(`resume_original_name`)) > 0)))),
  CONSTRAINT `ck_profiles_resume_size` CHECK (((`resume_size_bytes` is null) or (`resume_size_bytes` between 1 and 5242880))),
  CONSTRAINT `ck_profiles_skills` CHECK (json_schema_valid(_utf8mb4'{"type":"array","items":{"type":"string","minLength":1,"maxLength":60},"minItems":1,"maxItems":30,"uniqueItems":true}',`skills`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `job_categories` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `slug` varchar(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`),
  UNIQUE KEY `uq_categories_slug` (`slug`),
  CONSTRAINT `ck_categories_active` CHECK ((`is_active` in (0,1))),
  CONSTRAINT `ck_categories_name` CHECK ((char_length(trim(`name`)) between 1 and 80)),
  CONSTRAINT `ck_categories_slug` CHECK (regexp_like(`slug`,_utf8mb4'^[a-z0-9]+(-[a-z0-9]+)*$',_utf8mb4'c'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `job_options` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `kind` enum('experienceLevel','workMode','employmentType') NOT NULL,
  `code` varchar(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(80) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `requires_city` tinyint(1) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_job_options_code` (`kind`,`code`),
  UNIQUE KEY `uq_job_options_name` (`kind`,`name`),
  CONSTRAINT `ck_job_options_active` CHECK ((`is_active` in (0,1))),
  CONSTRAINT `ck_job_options_city` CHECK ((((`kind` = _utf8mb4'workMode') and (`requires_city` is not null) and (`requires_city` in (0,1))) or ((`kind` <> _utf8mb4'workMode') and (`requires_city` is null)))),
  CONSTRAINT `ck_job_options_code` CHECK (regexp_like(`code`,_ascii'^[a-z][a-z0-9_]{0,39}$',_utf8mb4'c')),
  CONSTRAINT `ck_job_options_name` CHECK ((char_length(trim(`name`)) between 1 and 80))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `jobs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `category_id` int unsigned NOT NULL,
  `created_by` int unsigned NOT NULL,
  `title` varchar(150) NOT NULL,
  `company_name` varchar(150) NOT NULL,
  `location_city` varchar(100) DEFAULT NULL,
  `employment_type` varchar(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'full_time',
  `work_mode` varchar(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'onsite',
  `experience_level` varchar(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `min_experience_months` smallint unsigned NOT NULL DEFAULT '0',
  `max_experience_months` smallint unsigned DEFAULT NULL,
  `salary_min_annual_inr` decimal(12,2) DEFAULT NULL,
  `salary_max_annual_inr` decimal(12,2) DEFAULT NULL,
  `description` text NOT NULL,
  `skills` json NOT NULL,
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('draft','published','closed') NOT NULL DEFAULT 'draft',
  `published_at` datetime(6) DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ix_jobs_browse` (`status`,`deleted_at`,`published_at` DESC,`id` DESC),
  KEY `ix_jobs_featured` (`is_featured`,`status`,`deleted_at`,`published_at` DESC,`id` DESC),
  KEY `ix_jobs_category_experience` (`category_id`,`experience_level`,`status`,`deleted_at`,`published_at` DESC,`id` DESC),
  KEY `ix_jobs_location` (`location_city`,`status`,`deleted_at`,`published_at` DESC,`id` DESC),
  KEY `ix_jobs_creator` (`created_by`),
  FULLTEXT KEY `ft_jobs_keyword` (`title`,`company_name`,`description`),
  CONSTRAINT `fk_jobs_category` FOREIGN KEY (`category_id`) REFERENCES `job_categories` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_jobs_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_jobs_company` CHECK ((char_length(trim(`company_name`)) between 1 and 150)),
  CONSTRAINT `ck_jobs_description` CHECK ((char_length(trim(`description`)) between 1 and 10000)),
  CONSTRAINT `ck_jobs_experience` CHECK (((`min_experience_months` <= 720) and ((`max_experience_months` is null) or (`max_experience_months` between `min_experience_months` and 720)))),
  CONSTRAINT `ck_jobs_featured` CHECK ((`is_featured` in (0,1))),
  CONSTRAINT `ck_jobs_location` CHECK (((`location_city` is null) or (char_length(trim(`location_city`)) between 1 and 100))),
  CONSTRAINT `ck_jobs_published` CHECK (((`status` = _utf8mb4'draft') or (`published_at` is not null))),
  CONSTRAINT `ck_jobs_salary` CHECK ((((`salary_min_annual_inr` is null) and (`salary_max_annual_inr` is null)) or ((`salary_min_annual_inr` is not null) and (`salary_max_annual_inr` is not null) and (`salary_min_annual_inr` >= 0) and (`salary_max_annual_inr` >= `salary_min_annual_inr`)))),
  CONSTRAINT `ck_jobs_skills` CHECK (json_schema_valid(_utf8mb4'{"type":"array","items":{"type":"string","minLength":1,"maxLength":60},"minItems":1,"maxItems":30,"uniqueItems":true}',`skills`)),
  CONSTRAINT `ck_jobs_title` CHECK ((char_length(trim(`title`)) between 1 and 150))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `job_applications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_id` int unsigned NOT NULL,
  `candidate_id` int unsigned NOT NULL,
  `cover_note` text,
  `status` enum('submitted','reviewed','shortlisted','rejected') NOT NULL DEFAULT 'submitted',
  `resume_storage_key` varchar(255) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `resume_original_name` varchar(255) DEFAULT NULL,
  `resume_size_bytes` int unsigned DEFAULT NULL,
  `resume_uploaded_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_applications_job_candidate` (`job_id`,`candidate_id`),
  KEY `ix_applications_candidate` (`candidate_id`,`created_at` DESC,`id` DESC),
  KEY `ix_applications_job` (`job_id`,`created_at` DESC,`id` DESC),
  CONSTRAINT `fk_applications_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidate_profiles` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_applications_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `ck_applications_note` CHECK (((`cover_note` is null) or (char_length(trim(`cover_note`)) between 1 and 2000))),
  CONSTRAINT `ck_applications_resume_complete` CHECK ((((`resume_storage_key` is null) and (`resume_original_name` is null) and (`resume_size_bytes` is null) and (`resume_uploaded_at` is null)) or ((`resume_storage_key` is not null) and (`resume_original_name` is not null) and (`resume_size_bytes` is not null) and (`resume_uploaded_at` is not null)))),
  CONSTRAINT `ck_applications_resume_names` CHECK (((`resume_storage_key` is null) or ((char_length(trim(`resume_storage_key`)) > 0) and (char_length(trim(`resume_original_name`)) > 0)))),
  CONSTRAINT `ck_applications_resume_size` CHECK (((`resume_size_bytes` is null) or (`resume_size_bytes` between 1 and 5242880)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `auth_sessions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `family_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `refresh_token_hash` binary(32) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `rotated_at` datetime(6) DEFAULT NULL,
  `revoked_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_refresh_hash` (`refresh_token_hash`),
  KEY `ix_auth_family` (`family_id`,`revoked_at`),
  KEY `ix_auth_user` (`user_id`,`revoked_at`,`expires_at`),
  KEY `ix_auth_expiry` (`expires_at`),
  CONSTRAINT `fk_auth_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_auth_expiry` CHECK ((`expires_at` > `created_at`)),
  CONSTRAINT `ck_auth_family` CHECK (regexp_like(`family_id`,_utf8mb4'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$',_utf8mb4'c')),
  CONSTRAINT `ck_auth_revoked` CHECK (((`revoked_at` is null) or (`revoked_at` >= `created_at`))),
  CONSTRAINT `ck_auth_rotated` CHECK (((`rotated_at` is null) or ((`rotated_at` >= `created_at`) and (`rotated_at` < `expires_at`))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Current job_categories values. IDs and activity settings are preserved.
INSERT INTO `job_categories` (`id`,`name`,`slug`,`is_active`) VALUES
(1,'Engineering','engineering',1),
(2,'Data & Analytics','data-analytics',1),
(3,'Design & Creative','design-creative',1),
(4,'Product & Operations','product-operations',1);

-- Current job_options values. IDs and activity settings are preserved.
INSERT INTO `job_options` (`id`,`kind`,`code`,`name`,`is_active`,`requires_city`) VALUES
(1,'experienceLevel','fresher','Fresher',1,NULL),
(2,'experienceLevel','junior','Junior',1,NULL),
(3,'experienceLevel','mid','Mid',1,NULL),
(4,'experienceLevel','senior','Senior',1,NULL),
(5,'workMode','onsite','Onsite',1,1),
(6,'workMode','hybrid','Hybrid',1,1),
(7,'workMode','remote','Remote',1,0),
(8,'employmentType','full_time','Full time',1,NULL),
(9,'employmentType','part_time','Part time',1,NULL),
(10,'employmentType','contract','Contract',1,NULL),
(11,'employmentType','internship','Internship',1,NULL);
