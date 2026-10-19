-- Explicit migration for existing installations. Do not run the fresh schema again.
-- MySQL DDL commits implicitly. Run the guarded migration script, not this file twice.
CREATE TABLE job_options (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('experienceLevel','workMode','employmentType') NOT NULL,
  code VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  requires_city BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_job_options_code (kind,code),
  UNIQUE KEY uq_job_options_name (kind,name),
  CONSTRAINT ck_job_options_code CHECK (REGEXP_LIKE(code,'^[a-z][a-z0-9_]{0,39}$','c')),
  CONSTRAINT ck_job_options_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 80),
  CONSTRAINT ck_job_options_active CHECK (is_active IN (0,1)),
  CONSTRAINT ck_job_options_city CHECK (requires_city IN (0,1))
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO job_options (kind,code,name,requires_city) VALUES
('experienceLevel','fresher','Fresher',1),('experienceLevel','junior','Junior',1),
('experienceLevel','mid','Mid',1),('experienceLevel','senior','Senior',1),
('workMode','onsite','Onsite',1),('workMode','hybrid','Hybrid',1),('workMode','remote','Remote',0),
('employmentType','full_time','Full time',1),('employmentType','part_time','Part time',1),
('employmentType','contract','Contract',1),('employmentType','internship','Internship',1);
ALTER TABLE jobs
  DROP CHECK ck_jobs_location,
  MODIFY employment_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'full_time',
  MODIFY work_mode VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'onsite',
  MODIFY experience_level VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ADD CONSTRAINT ck_jobs_location CHECK (location_city IS NULL OR CHAR_LENGTH(TRIM(location_city)) BETWEEN 1 AND 100);
-- City requirements are now option metadata, validated transactionally by the API.
