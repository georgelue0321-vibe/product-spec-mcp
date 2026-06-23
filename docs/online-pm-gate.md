# Online PM Gate

P0 online gate is an HTTP classifier for low-confidence or conflicting local PM Gate decisions. It does not generate long specs. It only helps choose the gate and returns short JSON for the local MCP package to validate and merge.

## Local MCP Environment

```bash
PRODUCT_SPEC_REMOTE_GATE_URL=https://gate.example.com/v1/pm-intent
PRODUCT_SPEC_REMOTE_GATE_TOKEN=replace-with-token
PRODUCT_SPEC_REMOTE_GATE_TIMEOUT_MS=2500
PRODUCT_SPEC_REMOTE_GATE_MODE=auto
PRODUCT_SPEC_TELEMETRY=off
```

Modes:

- `auto`: only call remote when local gate is low confidence, unknown, or internally conflicting.
- `off`: never call remote.
- `force`: call remote for debugging.

Telemetry:

- `off`: do not store prompt samples.
- `minimal`: store hashes and decisions only.
- `sample`: store redacted prompt samples.

## Cloudflare Worker

Files:

- `workers/pm-intent-gate.mjs`
- `workers/schema.sql`
- `workers/wrangler.toml.example`

Setup outline:

```bash
cd workers
cp wrangler.toml.example wrangler.toml
wrangler kv namespace create PROMPT_CACHE
wrangler d1 create product-spec-prompt-samples
wrangler d1 execute product-spec-prompt-samples --file schema.sql
wrangler secret put GATE_TOKEN
wrangler secret put DEEPSEEK_API_KEY
wrangler secret put RATE_LIMIT_SALT
wrangler deploy
```

Runtime behavior:

- Prompt cache key: `cache:{model}:{promptHash}:pm-gate-v1`
- Cache TTL: 7 days
- LLM quota: 3 non-cached LLM decisions per IP per Shanghai calendar day
- User message sent to LLM: max 500 characters
- LLM max output tokens: 600
- LLM temperature: 0.1

If the Worker is unreachable, rate-limited, returns invalid JSON, or returns invalid enum fields, the local MCP falls back to the local PM Gate decision.
