USE archit_platform;

SET @add_category = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME='project_inquiries'
     AND COLUMN_NAME='category') = 0,
  'ALTER TABLE project_inquiries ADD COLUMN category VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE add_category_statement FROM @add_category;
EXECUTE add_category_statement;
DEALLOCATE PREPARE add_category_statement;

SET @add_land_area = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME='project_inquiries'
     AND COLUMN_NAME='land_area') = 0,
  'ALTER TABLE project_inquiries ADD COLUMN land_area VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE add_land_area_statement FROM @add_land_area;
EXECUTE add_land_area_statement;
DEALLOCATE PREPARE add_land_area_statement;

SET @add_budget_min = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME='project_inquiries'
     AND COLUMN_NAME='budget_min') = 0,
  'ALTER TABLE project_inquiries ADD COLUMN budget_min DECIMAL(12,2) NULL',
  'SELECT 1'
);
PREPARE add_budget_min_statement FROM @add_budget_min;
EXECUTE add_budget_min_statement;
DEALLOCATE PREPARE add_budget_min_statement;

SET @add_budget_max = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME='project_inquiries'
     AND COLUMN_NAME='budget_max') = 0,
  'ALTER TABLE project_inquiries ADD COLUMN budget_max DECIMAL(12,2) NULL',
  'SELECT 1'
);
PREPARE add_budget_max_statement FROM @add_budget_max;
EXECUTE add_budget_max_statement;
DEALLOCATE PREPARE add_budget_max_statement;

SET @add_expected_timeline = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME='project_inquiries'
     AND COLUMN_NAME='expected_timeline') = 0,
  'ALTER TABLE project_inquiries ADD COLUMN expected_timeline VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE add_expected_timeline_statement FROM @add_expected_timeline;
EXECUTE add_expected_timeline_statement;
DEALLOCATE PREPARE add_expected_timeline_statement;

SET @add_preferred_style = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME='project_inquiries'
     AND COLUMN_NAME='preferred_style') = 0,
  'ALTER TABLE project_inquiries ADD COLUMN preferred_style VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE add_preferred_style_statement FROM @add_preferred_style;
EXECUTE add_preferred_style_statement;
DEALLOCATE PREPARE add_preferred_style_statement;
