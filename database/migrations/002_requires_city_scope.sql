-- requires_city applies only to work modes. Preserve all option labels/codes and timestamps.
ALTER TABLE job_options
  DROP CHECK ck_job_options_city,
  MODIFY requires_city BOOLEAN NULL DEFAULT NULL;
UPDATE job_options SET requires_city=NULL, updated_at=updated_at WHERE kind <> 'workMode';
ALTER TABLE job_options ADD CONSTRAINT ck_job_options_city CHECK (
  (kind='workMode' AND requires_city IS NOT NULL AND requires_city IN (0,1))
  OR (kind<>'workMode' AND requires_city IS NULL)
);
