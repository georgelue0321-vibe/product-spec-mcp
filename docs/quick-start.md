# product-spec-mcp Quick Start

## 用户只需要做三步

### 1. 注册 MCP

把下面配置放到你的 AI 工具 MCP 配置里：

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

如果你的工具使用 opencode 风格配置，用这一段：

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

### 2. 让 Agent 获取连接页

把这句话发给 Agent：

```text
请调用 product_spec_connect，帮我连接 product-spec-mcp 的完整在线能力。
```

Agent 会给出连接页：

```text
https://productmcp.opc-mind.top/connect
```

打开页面，点击“生成并下载连接文件”。

### 3. 把 JSON 文件发回 Agent

页面会下载：

```text
product-spec-mcp-connect.json
```

把这个 JSON 文件发回 Agent。Agent 会读取里面的 `instructions.env`，写入 MCP 配置。

再次重启或刷新 MCP 后，就可以使用完整能力：

```text
请调用 product_spec_assist，帮我把这个产品想法整理成可开发规格：……
```

## 注意

- 用户不需要 DeepSeek API Key。
- 不要手抄 token。
- 不要把 `product-spec-mcp-connect.json` 提交到 Git。
- 如果 Agent 还不能调用 `product_spec_connect`，说明 MCP 还没有注册成功，请先检查第 1 步。
