# product-spec-mcp

> 把一句模糊的产品想法，整理成 AI Agent 可以执行的工程规格。

很多人能说清“我想做什么”，但还没法直接写出功能范围、数据字段、架构边界和验收标准。`product-spec-mcp` 先帮你把想法过一遍产品经理式需求闸门，再交给 Codex、Claude、Cursor、OpenCode 等 Agent 开始写代码。

## 适合谁

- 你有一个小应用、网站、工具或 SaaS 想法，但不知道怎样拆成开发规格。
- 你是创始人、运营、设计师、小团队负责人、学生，或刚开始用 AI 写代码的人。
- 你希望 Agent 少脑补，先确认对象、字段、权限、接口、风险和验收标准。
- 你要判断一个需求第一版该做纯前端、本地存储、轻后端，还是完整 SaaS。

## 它会产出什么

- 追问清单：先问真正会影响实现的缺口，不套固定模板。
- 可执行规格：核心功能、数据模型、API 设计、非目标、风险边界。
- 架构建议：判断是否需要后端、登录、后台、数据库、支付或 AI Key 保护。
- 验收标准：把“做完了”变成可以检查的列表。

## 最短使用路径

### 用户只需要做三步

**第一步：把 MCP 注册到当前 AI 工具。**

通用 `mcp.json` 配置：

```json
{
  "mcpServers": {
    "product-spec": {
      "command": "npx",
      "args": ["-y", "product-spec-mcp@latest"]
    }
  }
}
```

如果你的工具使用 opencode 风格配置：

```json
{
  "mcp": {
    "product-spec": {
      "type": "local",
      "command": ["npx", "-y", "product-spec-mcp@latest"],
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

保存后，重启 IDE 或刷新 MCP 连接。

**第二步：把这句话发给 Agent。**

```text
请调用 product_spec_connect，帮我连接 product-spec-mcp 的完整在线能力。
```

它会返回连接页：

```text
https://productmcp.opc-mind.top/connect
```

打开页面后点击“生成并下载连接文件”。

**第三步：把下载的 JSON 文件发回 Agent。**

页面会下载 `product-spec-mcp-connect.json`。把这个文件发回 Agent；Agent 会读取 JSON 文件里的 `instructions.env`，写入当前 MCP 配置。再次重启或刷新 MCP 后即可使用完整能力。

普通用户不需要配置 DeepSeek API Key。连接文件里包含的是托管 Worker 生成的专属 `PRODUCT_SPEC_REMOTE_GATE_TOKEN`，用于启用完整的在线 PM Gate 能力。

完整说明见 [`docs/quick-start.md`](docs/quick-start.md)。

连接完成后，直接让 Agent 调用：

```text
product_spec_assist
```

如果不确定从哪个工具开始，直接让 Agent 调用：

```text
product_spec_assist
```

输入你的原话，例如：

```text
我想做一个活动报名系统，用户填姓名电话报名人数，后台能查看、搜索和导出 Excel。
```

它会自动判断该追问、编译规格、给架构建议，还是生成验收标准。

需要完整开发前规格时，推荐流程是：

```
1. spec_interrogate   → 评估需求完整度，生成追问清单
2. spec_compile       → 编译产品规格和开发 Prompt
3. architecture_decide → 判断架构方案
4. acceptance_generate → 生成验收标准
```

**在线 PM Gate 是完整能力的一部分。** 默认本地规则已经可用；连接后，低置信或冲突需求会走在线 LLM 辅助归门。首次使用建议先调用 `product_spec_connect`，按连接页下载 JSON 文件并交给当前 Agent 写入配置。

## Features

This MCP Server provides 8 tools for product development workflow:

| Tool | Description |
|------|-------------|
| `product_spec_assist` | **推荐入口** - 根据用户原话自动识别场景并调用对应能力 |
| `product_spec_connect` | **在线增强连接** - 引导用户下载连接文件，并生成当前 Agent 应写入的 MCP 环境变量 |
| `spec_interrogate` | Analyze requirement completeness and generate clarification questions |
| `spec_compile` | Compile full product specification and development prompt |
| `architecture_decide` | Make architecture decisions based on product type and features |
| `ui_translate` | Translate user UI descriptions into frontend terminology |
| `debug_guide` | Generate structured debugging checklists |
| `acceptance_generate` | Generate acceptance criteria for features |

## Installation

For npm-based MCP clients:

```bash
npx -y product-spec-mcp --help
```

The help output gives copyable MCP config snippets and the exact first message to send to the Agent.

For local development:

```bash
npm install
npm run build
```

## Usage

### As MCP Server (stdio)

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

## Optional Online PM Gate

默认只使用本地 PM Gate。需要让低置信或冲突需求走在线 LLM 辅助归门时，可以配置独立 HTTP gate：

对普通用户，推荐让 Agent 调用 `product_spec_connect`。用户只需要打开连接页，点击下载 `product-spec-mcp-connect.json`，再把文件发回 Agent；Agent 读取文件后把其中的 `instructions.env` 写入当前 MCP 配置即可。

```bash
PRODUCT_SPEC_REMOTE_GATE_URL=https://gate.example.com/v1/pm-intent
PRODUCT_SPEC_REMOTE_GATE_TOKEN=replace-with-token
PRODUCT_SPEC_REMOTE_GATE_TIMEOUT_MS=10000
PRODUCT_SPEC_REMOTE_GATE_MODE=auto
PRODUCT_SPEC_TELEMETRY=off
```

`auto` 模式只在本地规则低置信、unknown 或冲突时调用远程。远程失败、限流、超时或 schema 错误时会自动降级到本地判断。Cloudflare Workers 部署模板随 npm 包一起发布，见 `docs/online-pm-gate.md` 和 `docs/connect-flow.md`。

## MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "product-spec": {
      "command": "npx",
      "args": ["-y", "product-spec-mcp@latest"]
    }
  }
}
```

### Cursor

Add to your Cursor MCP configuration (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "product-spec": {
      "command": "npx",
      "args": ["-y", "product-spec-mcp@latest"]
    }
  }
}
```

### VS Code (Continue)

Add to your Continue configuration:

```json
{
  "mcpServers": {
    "product-spec": {
      "command": "npx",
      "args": ["-y", "product-spec-mcp@latest"]
    }
  }
}
```

### opencode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "product-spec": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "product-spec-mcp@latest"
      ],
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

> Note: opencode uses the `mcp` key. `mcpServers` is a Claude-style config key and will fail schema validation in current opencode versions.

## FAQ

### Where are maintainer notes?

If you plan to modify this MCP server itself, read the maintainer notes first:

- [product-spec-mcp update lessons](https://github.com/georgelue0321-vibe/product-spec-mcp/blob/main/docs/product-spec-mcp-update-lessons.md)

Client-specific integration notes are intentionally kept out of the main user flow. They live under `docs/` in the GitHub repository for maintainers who need them.

## Tools Documentation

### product_spec_assist (推荐入口)

统一入口：根据用户原话自动判断场景并调用对应能力。

**Input:**
- `message` (required): 用户原话
- `known_context`: 已有上下文
- `preferred_platform`: `web` | `mini_program` | `app` | `backend` | `unknown`
- `strictness`: `light` | `normal` | `grill`
- `auto_execute`: boolean (default: true)

**Example:**
```json
{
  "message": "我想做一个报名系统，学生可以提交资料，后台老师审核",
  "preferred_platform": "web"
}
```

**路由规则:**

| 场景 | 自动调用 |
|------|----------|
| 产品开发 | `spec_interrogate` |
| UI 修改 | `ui_translate` |
| Debug 排查 | `debug_guide` |
| 上线部署 | 信息缺口检查 |

---

### product_spec_connect

引导用户连接在线 PM Gate。未配置时返回连接页面；收到连接文件后返回当前 Agent 应写入 MCP 配置的环境变量。

**Input:**
- `connect_file`: 用户从连接页下载的 `product-spec-mcp-connect.json` 内容
- `client`: 当前 Agent 名称，例如 `workbuddy`、`codex`、`opencode`

**Example:**
```json
{
  "client": "workbuddy"
}
```

如果用户已经上传连接文件：

```json
{
  "client": "workbuddy",
  "connect_file": {
    "type": "product-spec-mcp-connect",
    "client": "workbuddy",
    "useCases": ["personal_app_site", "client_requirements"],
    "instructions": {
      "env": {
        "PRODUCT_SPEC_REMOTE_GATE_URL": "https://productmcp.opc-mind.top/v1/pm-intent",
        "PRODUCT_SPEC_REMOTE_GATE_TOKEN": "psm_xxx",
        "PRODUCT_SPEC_REMOTE_GATE_MODE": "auto"
      }
    }
  }
}
```

---

### spec_interrogate

Analyze requirement completeness and generate clarification questions.

**Input:**
- `raw_idea` (required): User's original idea description
- `scenario`: `build_product` | `modify_ui` | `debug` | `launch` | `unknown`
- `target_platform`: `web` | `mini_program` | `app` | `backend` | `unknown`
- `strictness`: `light` | `normal` | `grill`
- `known_context`: Object with known context information

**Example:**
```json
{
  "raw_idea": "我想做一个报名系统，用户可以提交资料，后台能看到",
  "scenario": "build_product",
  "target_platform": "web"
}
```

### spec_compile

Compile full product specification and development prompt.

**Input:**
- `raw_idea` (required): User's original idea
- `answers`: Object with answers to clarification questions
- `allow_assumptions`: boolean (default: true)
- `min_readiness_score`: number (default: 70)

**Example:**
```json
{
  "raw_idea": "报名系统",
  "answers": {
    "target_user": "学生",
    "platform": "web",
    "data_persistence": true
  },
  "allow_assumptions": true
}
```

### architecture_decide

Make architecture decisions based on product type and features.

**Input:**
- `product_type` (required): Product type description
- `platform` (required): `web` | `mini_program` | `app` | `backend`
- `features` (required): Array of feature descriptions
- `commercial_intent`: boolean
- `expected_users`: `individual` | `small_team` | `enterprise` | `massive`

**Example:**
```json
{
  "product_type": "电商系统",
  "platform": "web",
  "features": ["商品展示", "购物车", "支付", "订单管理"],
  "commercial_intent": true,
  "expected_users": "small_team"
}
```

### ui_translate

Translate user UI descriptions into frontend terminology.

**Input:**
- `description` (required): User's UI description
- `current_page`: Current page name
- `target_component`: Target component name

**Example:**
```json
{
  "description": "首页看起来太廉价了，高级一点",
  "current_page": "首页"
}
```

### debug_guide

Generate structured debugging checklists.

**Input:**
- `platform` (required): `web` | `mini_program` | `app` | `backend` | `build` | `unknown`
- `error_description` (required): Error description
- `current_info`: Object with known error information

**Example:**
```json
{
  "platform": "web",
  "error_description": "点击提交按钮后页面白屏"
}
```

### acceptance_generate

Generate acceptance criteria for features.

**Input:**
- `product_type` (required): Product type
- `features` (required): Array of features
- `platform` (required): `web` | `mini_program` | `app` | `backend`
- `has_backend`: boolean
- `has_payment`: boolean
- `has_auth`: boolean

**Example:**
```json
{
  "product_type": "表单工具",
  "features": ["表单提交", "数据查看"],
  "platform": "web",
  "has_backend": true
}
```

## Development

### Run Tests

```bash
npm test
```

### Type Check

```bash
npm run typecheck
```

### Build

```bash
npm run build
```

## Architecture

```
src/
├── index.ts           # Entry point
├── server.ts          # MCP Server setup and tool registration
├── tools/             # Tool handlers
├── core/              # Business logic engines
├── schemas/           # Zod schemas
├── rules/             # JSON rule files
└── utils/             # Utility functions
```

## License

MIT

## Structured Outputs

Each tool returns human-readable Markdown in `content` and machine-readable JSON in `structuredContent`.

**Example: `spec_interrogate` structured output**

```json
{
  "readiness": {
    "score": 35,
    "status": "Not Ready",
    "fields": { ... }
  },
  "clarification": {
    "missingFields": ["target_user", "data_persistence"],
    "questions": [
      {
        "field": "target_user",
        "question": "目标用户是谁？",
        "whyImportant": "决定 UI 风格、交互复杂度、技术选型",
        "options": ["个人用户", "小团队", "企业用户"],
        "defaultAssumption": "个人用户",
        "priority": "P0"
      }
    ],
    "defaultAssumptions": { ... }
  },
  "recommendation": {
    "canProceed": false,
    "suggestedNextTool": "spec_interrogate",
    "reason": "信息不足，需要先回答追问"
  }
}
```

**Key structured fields:**

| Tool | Key Fields |
|------|------------|
| `spec_interrogate` | `readiness.score`, `clarification.questions`, `recommendation.canProceed` |
| `spec_compile` | `mode`, `spec.coreFeatures`, `nextAction.type` |
| `acceptance_generate` | `categories`, `checklist`, `definitionOfDone` |
| `architecture_decide` | `decision.canBeFrontendOnly`, `riskLevel`, `blockers` |
| `ui_translate` | `translation.frontendTerms`, `confidence` |
| `debug_guide` | `guide.checklist`, `missingRequiredInfo`, `canDiagnoseNow` |

## 示例

### 示例 1：报名系统

**输入：**
```json
{
  "raw_idea": "我想做一个报名系统，用户可以提交资料，后台能看到所有报名信息并审核",
  "scenario": "build_product",
  "target_platform": "web"
}
```

**推荐流程：**

1. 先调用 `spec_interrogate`，会追问：目标用户是谁？是否需要登录？是否需要保存数据？
2. 补充信息后调用 `spec_compile`，生成产品规格和开发 Prompt
3. 调用 `architecture_decide`，判断是否需要后端和数据库
4. 调用 `acceptance_generate`，生成验收清单

### 示例 2：展示官网

**输入：**
```json
{
  "raw_idea": "做一个产品展示官网，只需要静态展示",
  "scenario": "build_product",
  "target_platform": "web"
}
```

**预期行为：**

- `architecture_decide` 会推荐纯前端架构，不推荐数据库
- `spec_compile` 会生成简洁的静态站点规格
- 不会输出伪 API 设计
