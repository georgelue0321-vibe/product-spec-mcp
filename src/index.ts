#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

function shouldPrintHelp(args: string[]): boolean {
  return args.some((arg) => arg === "--help" || arg === "-h" || arg === "help");
}

function printHelp(): void {
  console.log(`product-spec-mcp

这是一个 MCP Server。用户不需要 DeepSeek API Key，也不要手抄 token。

用户只需要做 3 件事：

1. 把 product-spec-mcp 注册到当前 AI 工具的 MCP 配置里。

通用 mcp.json 配置：

{
  "mcpServers": {
    "product-spec": {
      "command": "npx",
      "args": ["-y", "product-spec-mcp@latest"]
    }
  }
}

如果你的 AI 工具使用 opencode 风格配置：

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

2. 重启或刷新 AI 工具的 MCP 连接，然后把这句话发给 Agent：

请调用 product_spec_connect，帮我连接 product-spec-mcp 的完整在线能力。

3. Agent 会给出连接页。打开页面下载 product-spec-mcp-connect.json，
   再把这个 JSON 文件发回 Agent。Agent 会写入 MCP 配置里的
   PRODUCT_SPEC_REMOTE_GATE_* 环境变量。再次重启或刷新 MCP 后即可使用。

连接页： https://productmcp.opc-mind.top/connect

连接完成后，直接对 Agent 说你的产品想法，并让它调用 product_spec_assist。
`);
}

async function main() {
  if (shouldPrintHelp(process.argv.slice(2))) {
    printHelp();
    return;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
