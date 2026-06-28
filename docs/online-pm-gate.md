# Online PM Gate

P0 online gate is an HTTP classifier for low-confidence or conflicting local PM Gate decisions. It does not generate long specs. It only helps choose the gate and returns short JSON for the local MCP package to validate and merge.

## Local MCP Environment

```bash
PRODUCT_SPEC_REMOTE_GATE_URL=https://gate.example.com/v1/pm-intent
PRODUCT_SPEC_REMOTE_GATE_TOKEN=replace-with-token
PRODUCT_SPEC_REMOTE_GATE_TIMEOUT_MS=10000
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

Default LLM provider:

```toml
[vars]
LLM_PROVIDER = "deepseek"
LLM_BASE_URL = "https://api.deepseek.com"
LLM_MODEL = "deepseek-v4-flash"
DAILY_LLM_LIMIT = "20"
```

To switch later to Mimo, change the Worker vars to:

```toml
[vars]
LLM_PROVIDER = "mimo"
LLM_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1"
LLM_MODEL = "mimo-v2.5"
```

Then set:

```bash
wrangler secret put MIMO_API_KEY
```

Runtime behavior:

- Prompt cache key: `cache:{model}:{promptHash}:pm-gate-v1`
- Cache TTL: 7 days
- LLM quota: `DAILY_LLM_LIMIT` non-cached LLM decisions per IP per Shanghai calendar day. Default: 20.
- Self-serve token quota: `CONNECT_TOKEN_DAILY_LIMIT` can override the daily limit for newly generated `psm_` tokens. If omitted, it inherits `DAILY_LLM_LIMIT`.
- Optional monthly token quota: `CONNECT_TOKEN_MONTHLY_LIMIT` limits monthly non-cached LLM calls per token.
- User message sent to LLM: max 500 characters
- LLM max output tokens: 600
- LLM temperature: 0.1

## Self-Serve Connect Flow

0.4 版本新增浏览器连接页，给非技术用户使用：

```http
GET /connect
POST /v1/connect-token
```

用户打开 `/connect` 后点击下载 `product-spec-mcp-connect.json`。文件里包含当前 Agent 应写入 MCP 配置的环境变量：

页面会额外收集两个轻量字段：当前 AI 工具和主要用途。AI 工具选项是 WorkBuddy / Claude Desktop / Claude Code / Codex / OpenCode / 其他；主要用途支持多选，包括给自己做小应用 / 网站、帮客户梳理需求、公司 / 团队内部项目、学习或测试 MCP、其他。它们会写入 D1 的 token metadata，用于后续产品方向分析和生成更准确的配置片段。

```json
{
  "PRODUCT_SPEC_REMOTE_GATE_URL": "https://productmcp.opc-mind.top/v1/pm-intent",
  "PRODUCT_SPEC_REMOTE_GATE_TOKEN": "psm_xxx",
  "PRODUCT_SPEC_REMOTE_GATE_MODE": "auto",
  "PRODUCT_SPEC_REMOTE_GATE_TIMEOUT_MS": "10000",
  "PRODUCT_SPEC_TELEMETRY": "off"
}
```

MCP 侧对应工具是 `product_spec_connect`。Agent 应先调用它拿连接页；用户上传连接文件后，再调用它解析出应写入当前 MCP 配置的 `env`。

`psm_` token 会写入 D1 的 `api_tokens` 表，Worker 只存 hash，不存明文 token。调用 `/v1/pm-intent` 时，Worker 仍兼容旧的全局 `GATE_TOKEN`。

## Change LLM Daily Quota

`DAILY_LLM_LIMIT` controls the number of non-cached LLM gate calls allowed per IP per Shanghai calendar day. It is a Worker runtime variable, not an npm package setting.

Default:

```toml
DAILY_LLM_LIMIT = "20"
```

To change it from local config:

```bash
cd /Users/george/Documents/product-spec-mcp/workers
# edit DAILY_LLM_LIMIT in wrangler.toml
npx wrangler deploy
```

To change it from Cloudflare Dashboard:

1. Open Worker `product-spec-pm-intent-gate`.
2. Go to Variables and Secrets.
3. Edit plaintext variable `DAILY_LLM_LIMIT`.
4. Save/deploy the Worker configuration.

Changing only this quota does not require an npm release. npm only needs to be published when the package code, bundled Worker file, or documentation should be distributed to npm users.

If the Worker is unreachable, rate-limited, returns invalid JSON, or returns invalid enum fields, the local MCP falls back to the local PM Gate decision.
