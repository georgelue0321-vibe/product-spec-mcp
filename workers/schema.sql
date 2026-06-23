CREATE TABLE IF NOT EXISTS prompt_samples (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  package_version TEXT,
  client TEXT,
  telemetry_mode TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  message_sample TEXT,
  rule_decision_json TEXT NOT NULL,
  llm_decision_json TEXT,
  final_decision_json TEXT NOT NULL,
  llm_used INTEGER NOT NULL,
  cache_hit INTEGER NOT NULL,
  prompt_tokens_approx INTEGER,
  completion_tokens_approx INTEGER,
  rate_limit_status TEXT,
  fallback_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_prompt_samples_created_at
ON prompt_samples(created_at);

CREATE INDEX IF NOT EXISTS idx_prompt_samples_message_hash
ON prompt_samples(message_hash);
