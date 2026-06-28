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

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  token_prefix TEXT NOT NULL,
  label TEXT,
  client TEXT,
  use_case TEXT,
  daily_limit INTEGER NOT NULL,
  monthly_limit INTEGER,
  enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash
ON api_tokens(token_hash);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  token_id TEXT,
  created_at TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_month TEXT NOT NULL,
  llm_used INTEGER NOT NULL,
  cache_hit INTEGER NOT NULL,
  model TEXT,
  prompt_tokens_approx INTEGER,
  completion_tokens_approx INTEGER,
  cost_units INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_token_month
ON usage_events(token_id, event_month);
