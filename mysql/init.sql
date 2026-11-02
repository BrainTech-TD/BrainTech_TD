CREATE DATABASE IF NOT EXISTS tododb;
USE tododb;

CREATE TABLE IF NOT EXISTS todos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  due_date DATE NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO todos (title, priority, due_date) VALUES
  ('Learn Docker', 'high', NULL),
  ('Write Dockerfile', 'medium', NULL),
  ('Set up Docker Compose', 'low', NULL);
