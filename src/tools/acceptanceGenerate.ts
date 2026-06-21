import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AcceptanceGenerateInputSchema } from "../schemas/acceptanceGenerate.schema.js";
import { AcceptanceGenerateOutputSchema } from "../schemas/outputs/acceptanceGenerate.output.js";
import { generateAcceptance } from "../core/acceptanceEngine.js";
import { formatAcceptanceResult } from "../core/markdownFormatter.js";
import { buildAcceptanceStructuredOutput } from "../core/structuredResultBuilder.js";
import type { z } from "zod";

type Input = z.infer<typeof AcceptanceGenerateInputSchema>;

export function registerAcceptanceGenerate(server: McpServer): void {
  const handler = async (input: Input) => {
    const acceptance = generateAcceptance(
      input.product_type,
      input.features,
      input.platform,
      input.has_backend,
      input.has_payment,
      input.has_auth
    );
    const markdown = formatAcceptanceResult(acceptance);
    const structuredContent = buildAcceptanceStructuredOutput(acceptance);

    return {
      content: [{ type: "text" as const, text: markdown }],
      structuredContent,
    };
  };

  server.registerTool(
    "acceptance_generate",
    {
      title: "验收标准生成",
      description: "根据产品类型和功能，生成验收标准。",
      inputSchema: AcceptanceGenerateInputSchema.shape,
      outputSchema: AcceptanceGenerateOutputSchema.shape,
    },
    handler
  );
}
