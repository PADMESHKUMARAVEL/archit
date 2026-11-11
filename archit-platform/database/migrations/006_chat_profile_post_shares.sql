USE archit_platform;

ALTER TABLE messages
  ADD COLUMN shared_type ENUM('PROFILE','POST') NULL AFTER attachment_url,
  ADD COLUMN shared_id BIGINT UNSIGNED NULL AFTER shared_type,
  ADD INDEX idx_messages_shared_resource (shared_type, shared_id);
