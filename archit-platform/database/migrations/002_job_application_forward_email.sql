USE archit_platform;

ALTER TABLE job_applications
  ADD COLUMN forward_email VARCHAR(255) NULL AFTER resume_url;
