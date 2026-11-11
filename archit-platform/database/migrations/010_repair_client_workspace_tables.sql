USE archit_platform;

ALTER TABLE project_inquiries
  MODIFY COLUMN status ENUM(
    'PENDING',
    'VIEWED',
    'RESPONDED',
    'IN_DISCUSSION',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED',
    'COMPLETED'
  ) NOT NULL DEFAULT 'PENDING';

CREATE TABLE IF NOT EXISTS saved_architects (
  client_id BIGINT UNSIGNED NOT NULL,
  architect_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, architect_id),
  CONSTRAINT fk_saved_architect_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_architect_architect FOREIGN KEY (architect_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_saved_architect_architect (architect_id, client_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS enquiry_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inquiry_id BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_enquiry_document_inquiry FOREIGN KEY (inquiry_id) REFERENCES project_inquiries(id) ON DELETE CASCADE,
  CONSTRAINT fk_enquiry_document_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_enquiry_documents_inquiry (inquiry_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS client_projects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inquiry_id BIGINT UNSIGNED NOT NULL UNIQUE,
  client_id BIGINT UNSIGNED NOT NULL,
  architect_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NULL,
  location VARCHAR(255) NULL,
  status ENUM(
    'INITIATED',
    'PLANNING',
    'DESIGN',
    'APPROVAL',
    'IN_PROGRESS',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'INITIATED',
  start_date DATE NULL,
  expected_completion_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_client_project_inquiry FOREIGN KEY (inquiry_id) REFERENCES project_inquiries(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_project_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_project_architect FOREIGN KEY (architect_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_client_projects_client (client_id, updated_at),
  INDEX idx_client_projects_architect (architect_id, updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_updates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  progress TINYINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_update_project FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_update_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_project_updates_project (project_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_milestones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  due_date DATE NULL,
  status ENUM('PENDING','COMPLETED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_milestone_project FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE CASCADE,
  INDEX idx_project_milestones_project (project_id, due_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_document_project FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_document_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_project_documents_project (project_id, created_at)
) ENGINE=InnoDB;
