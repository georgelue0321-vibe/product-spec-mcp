import { z } from "zod";

export const ProductSpecConnectInputSchema = z.object({
  connect_file: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("用户从 /connect 下载的 product-spec-mcp-connect.json 内容"),
  client: z
    .string()
    .optional()
    .describe("当前 Agent 或 MCP 客户端名称，例如 workbuddy、claude_desktop、cursor、codex、unknown"),
});

export type ProductSpecConnectInput = z.infer<typeof ProductSpecConnectInputSchema>;
