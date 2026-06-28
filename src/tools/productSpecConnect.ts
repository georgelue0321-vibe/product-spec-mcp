import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ProductSpecConnectInputSchema } from "../schemas/productSpecConnect.schema.js";
import { ProductSpecConnectOutputSchema } from "../schemas/outputs/productSpecConnect.output.js";
import { buildConnectGuide } from "../core/connectGuide.js";
import type { z } from "zod";

type Input = z.infer<typeof ProductSpecConnectInputSchema>;

export function registerProductSpecConnect(server: McpServer): void {
  const handler = async (input: Input) => {
    const result = buildConnectGuide(input.connect_file, input.client || "unknown");
    const isError = Boolean(input.connect_file && !result.env && result.warnings.length > 0);
    return {
      content: [{ type: "text" as const, text: formatConnectGuide(result) }],
      structuredContent: result,
      isError,
    };
  };

  server.registerTool(
    "product_spec_connect",
    {
      title: "连接在线 PM Gate",
      description:
        "首次使用或在线增强未配置时先调用本工具。返回连接页，引导用户获取专属 token 并下载 product-spec-mcp-connect.json；收到 JSON 文件后返回应写入当前 Agent MCP 配置的环境变量。",
      inputSchema: ProductSpecConnectInputSchema.shape,
      outputSchema: ProductSpecConnectOutputSchema.shape,
    },
    handler
  );
}

function formatConnectGuide(result: ReturnType<typeof buildConnectGuide>): string {
  const lines = [
    "# product-spec MCP 在线增强连接",
    "",
    `- **当前状态:** ${result.configured ? "已配置" : "未配置或待写入配置"}`,
    `- **连接页面:** ${result.connectUrl}`,
    "",
    "## 下一步",
    "",
    ...result.steps.map((step, index) => `${index + 1}. ${step}`),
  ];

  if (result.env) {
    lines.push("", "## 需要写入 MCP 配置的环境变量", "", "```json", JSON.stringify(result.env, null, 2), "```");
  }

  if (result.warnings.length > 0) {
    lines.push("", "## 注意", "", ...result.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join("\n");
}
