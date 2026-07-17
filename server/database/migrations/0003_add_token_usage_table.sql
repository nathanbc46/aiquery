CREATE TABLE IF NOT EXISTS ai_token_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(50) NOT NULL,
  model_used VARCHAR(100),
  user_id VARCHAR(36),
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  iterations INT DEFAULT 1,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
