# product-spec MCP 0.4 Connect Flow

目标：让普通用户不用手抄 token，也不用理解不同 Agent 的 MCP 配置格式。用户只做三步：

1. Agent 提示打开连接页。
2. 用户点击下载 `product-spec-mcp-connect.json`。
3. 用户把连接文件发回 Agent，由 Agent 写入 MCP 配置。

## User Flow

Agent 侧先调用：

```json
{
  "tool": "product_spec_connect",
  "arguments": {
    "client": "current-agent-name"
  }
}
```

MCP 返回连接页，默认是：

```text
https://productmcp.opc-mind.top/connect
```

用户打开页面后点击“生成并下载连接文件”。页面调用 Worker：

```http
POST /v1/connect-token
```

页面会让用户选择两个轻量字段：

- 正在用哪个 AI 工具：WorkBuddy / Claude Desktop / Claude Code / Codex / OpenCode / 其他（请填写）
- 准备用它做什么：给自己做小应用 / 网站、帮客户梳理需求、公司 / 团队内部项目、学习或测试 MCP、其他（请填写），支持多选

Worker 会创建一个 `psm_` 开头的专属 token，保存这两个字段，并返回连接文件。

## Connect File

下载文件名：

```text
product-spec-mcp-connect.json
```

文件格式：

```json
{
  "type": "product-spec-mcp-connect",
  "version": 1,
  "client": "workbuddy",
  "clientKey": "workbuddy",
  "useCase": "personal_app_site,client_requirements",
  "useCases": ["personal_app_site", "client_requirements"],
  "remoteGate": {
    "url": "https://productmcp.opc-mind.top/v1/pm-intent",
    "token": "psm_xxx",
    "mode": "auto",
    "timeoutMs": 10000,
    "telemetry": "off"
  },
  "instructions": {
    "summary": "请把 remoteGate 配置写入当前 Agent 的 product-spec-mcp 环境变量。",
    "env": {
      "PRODUCT_SPEC_REMOTE_GATE_URL": "https://productmcp.opc-mind.top/v1/pm-intent",
      "PRODUCT_SPEC_REMOTE_GATE_TOKEN": "psm_xxx",
      "PRODUCT_SPEC_REMOTE_GATE_MODE": "auto",
      "PRODUCT_SPEC_REMOTE_GATE_TIMEOUT_MS": "10000",
      "PRODUCT_SPEC_TELEMETRY": "off"
    },
    "clientHint": {
      "target": "WorkBuddy MCP wrapper",
      "action": "把 instructions.env 写入 WorkBuddy 中 product-spec MCP server 的环境变量配置，然后重启 MCP。"
    },
    "configSnippet": {
      "env": {}
    }
  }
}
```

Agent 收到文件后，再调用：

```json
{
  "tool": "product_spec_connect",
  "arguments": {
    "client": "current-agent-name",
    "connect_file": {}
  }
}
```

把真实文件 JSON 放到 `connect_file`。MCP 会返回应写入当前 Agent MCP 配置的 `env`。

## Agent Responsibility

Agent 应做的事：

- 读取 `instructions.env`。
- 写入当前 Agent 的 product-spec MCP server 配置。
- 重启或刷新 MCP server。
- 再调用 `product_spec_connect` 验证 `configured=true`。

Agent 不应该做的事：

- 不要让用户手抄 token。
- 不要把 token 打印到公开日志。
- 不要把连接文件提交到 Git。
- 不要把 `psm_` token 写入项目源码。

## Worker Endpoints

```http
GET /connect
POST /v1/connect-token
POST /v1/pm-intent
GET /health
```

`/v1/pm-intent` 同时接受两类 token：

- 旧的全局 `GATE_TOKEN`，用于内部验证和兼容老配置。
- 新的 `psm_` token，用于用户自助连接和后续计量。

## Storage

D1 新增两张表：

```sql
api_tokens
usage_events
```

`api_tokens` 存 token hash，不存明文 token。`usage_events` 记录按 token 的 LLM 使用情况，后续可以接入计费、月额度、封禁和用户面板。

`api_tokens` 还会保存：

```sql
client TEXT,
use_case TEXT
```

这两个字段用于判断真实用户分布和后续生成更准确的 Agent 配置提示。

## Quotas

默认每日额度仍由 Worker 变量控制：

```toml
DAILY_LLM_LIMIT = "20"
```

连接页生成的新 token 默认继承 `DAILY_LLM_LIMIT`。如果需要给连接 token 单独设置每日额度，可配置：

```toml
CONNECT_TOKEN_DAILY_LIMIT = "20"
```

如果需要月额度，可配置：

```toml
CONNECT_TOKEN_MONTHLY_LIMIT = "600"
```

改这些值只需要重新部署 Worker，或在 Cloudflare Dashboard 修改 Worker 环境变量，不需要发布 npm。

## Security Notes

- 连接文件包含访问 token，只应交给当前 Agent。
- Worker 只把 token hash 写入 D1。
- MCP 本地包不内置任何用户 token。
- 远程失败、限流或超时时，本地 MCP 会降级到本地 PM Gate。
