# product-spec-mcp

> 防止 AI 编程一上来就乱写代码的 MCP 工具。

把用户的模糊产品想法变成追问清单、可执行规格、架构建议和验收标准。

## 适用场景

当你或 AI 编程助手拿到一句话需求（"做一个报名系统"、"页面高级一点"、"接口报错了"），不要直接开工。先过一遍需求闸门，减少返工。

## 推荐流程

```
1. spec_interrogate   → 评估需求完整度，生成追问清单
2. spec_compile       → 编译产品规格和开发 Prompt
3. architecture_decide → 判断架构方案
4. acceptance_generate → 生成验收标准
```

**不确定用哪个工具？** 先用 `product_spec_assist`，它会自动识别场景并调用合适的工具。

## Features

This MCP Server provides 7 tools for product development workflow:

| Tool | Description |
|------|-------------|
| `product_spec_assist` | **推荐入口** - 根据用户原话自动识别场景并调用对应能力 |
| `spec_interrogate` | Analyze requirement completeness and generate clarification questions |
| `spec_compile` | Compile full product specification and development prompt |
| `architecture_decide` | Make architecture decisions based on product type and features |
| `ui_translate` | Translate user UI descriptions into frontend terminology |
| `debug_guide` | Generate structured debugging checklists |
| `acceptance_generate` | Generate acceptance criteria for features |

## Installation

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

## MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "product-spec": {
      "command": "node",
      "args": ["/path/to/product-spec-mcp/dist/index.cjs"]
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
      "command": "node",
      "args": ["/path/to/product-spec-mcp/dist/index.cjs"]
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
      "command": "node",
      "args": ["/path/to/product-spec-mcp/dist/index.cjs"]
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
        "node",
        "/path/to/product-spec-mcp/dist/index.cjs"
      ],
      "cwd": "/path/to/product-spec-mcp",
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
