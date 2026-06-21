import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ArchitectureDecideInputSchema } from "../schemas/architectureDecide.schema.js";
import { ArchitectureDecideOutputSchema } from "../schemas/outputs/architectureDecide.output.js";
import { decideArchitecture } from "../core/architectureEngine.js";
import { formatArchitectureResult } from "../core/markdownFormatter.js";
import { buildArchitectureStructuredOutput } from "../core/structuredResultBuilder.js";
import type { z } from "zod";

type Input = z.infer<typeof ArchitectureDecideInputSchema>;

export function registerArchitectureDecide(server: McpServer): void {
  const handler = async (input: Input) => {
    const decision = decideArchitecture(
      input.product_type,
      input.platform,
      input.features,
      input.commercial_intent,
      input.expected_users
    );
    const markdown = formatArchitectureResult(decision);
    const structuredContent = buildArchitectureStructuredOutput(decision);

    return {
      content: [{ type: "text" as const, text: markdown }],
      structuredContent,
    };
  };

  server.registerTool(
    "architecture_decide",
    {
      title: "架构决策",
      description:
        "根据产品类型、平台、功能、商业化意图判断架构方案。",
      inputSchema: ArchitectureDecideInputSchema.shape,
      outputSchema: ArchitectureDecideOutputSchema.shape,
    },
    handler
  );
}
