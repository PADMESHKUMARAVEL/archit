USE archit_platform;

ALTER TABLE conversations
  MODIFY COLUMN conversation_type ENUM(
    'CONNECTION',
    'APPLICATION',
    'CLIENT_ENQUIRY',
    'CLIENT_PROJECT_PROPOSAL'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS client_project_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NULL,
  land_area VARCHAR(100) NULL,
  budget_min DECIMAL(12,2) NULL,
  budget_max DECIMAL(12,2) NULL,
  expected_timeline VARCHAR(100) NULL,
  preferred_style VARCHAR(255) NULL,
  status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_client_project_request_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_client_project_request_board (status,category,created_at),
  INDEX idx_client_project_request_client (client_id,status,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS client_project_request_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_client_project_request_document_request FOREIGN KEY (request_id) REFERENCES client_project_requests(id) ON DELETE CASCADE,
  INDEX idx_client_project_request_documents (request_id,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS client_project_proposals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  architect_id BIGINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  status ENUM('PENDING','SHORTLISTED','REJECTED','ACCEPTED') NOT NULL DEFAULT 'PENDING',
  conversation_id BIGINT UNSIGNED NULL UNIQUE,
  inquiry_id BIGINT UNSIGNED NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_client_project_proposal_request FOREIGN KEY (request_id) REFERENCES client_project_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_project_proposal_architect FOREIGN KEY (architect_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_project_proposal_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  CONSTRAINT fk_client_project_proposal_inquiry FOREIGN KEY (inquiry_id) REFERENCES project_inquiries(id) ON DELETE SET NULL,
  UNIQUE KEY uq_client_project_request_architect (request_id,architect_id),
  INDEX idx_client_project_proposals_request (request_id,status,created_at),
  INDEX idx_client_project_proposals_architect (architect_id,status,created_at)
) ENGINE=InnoDB;
