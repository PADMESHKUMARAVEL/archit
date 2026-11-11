USE archit_platform;

ALTER TABLE users
  ADD COLUMN phone VARCHAR(50) NULL,
  ADD COLUMN client_type VARCHAR(100) NULL,
  ADD COLUMN organization VARCHAR(255) NULL,
  ADD COLUMN notification_preferences JSON NULL;

SET @has_client_phone = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='client_profiles'
    AND COLUMN_NAME='phone'
);
SET @has_client_preferences = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='client_profiles'
    AND COLUMN_NAME='notification_preferences'
);

SET @copy_client_fields = CONCAT(
  'UPDATE users u JOIN client_profiles cp ON cp.user_id=u.id ',
  'SET u.organization=COALESCE(cp.organization,u.organization), ',
  'u.client_type=COALESCE(cp.client_type,u.client_type)',
  IF(@has_client_phone > 0, ', u.phone=COALESCE(cp.phone,u.phone)', ''),
  IF(@has_client_preferences > 0, ', u.notification_preferences=COALESCE(cp.notification_preferences,u.notification_preferences)', ''),
  ' WHERE u.role=''CLIENT'''
);
PREPARE copy_client_fields_statement FROM @copy_client_fields;
EXECUTE copy_client_fields_statement;
DEALLOCATE PREPARE copy_client_fields_statement;

UPDATE users
SET client_type='INDIVIDUAL'
WHERE role='CLIENT' AND (client_type IS NULL OR client_type='');
