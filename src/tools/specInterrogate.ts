import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SpecInterrogateInputSchema } from "../schemas/specInterrogate.schema.js";
import { SpecInterrogateOutputSchema } from "../schemas/outputs/specInterrogate.output.js";
import { calculateReadiness } from "../core/specReadiness.js";
import { generateClarification } from "../core/clarificationEngine.js";
import { formatInterrogateResult } from "../core/markdownFormatter.js";
import { buildInterrogateStructuredOutput } from "../core/structuredResultBuilder.js";
import type { z } from "zod";

type Input = z.infer<typeof SpecInterrogateInputSchema>;

export function registerSpecInterrogate(server: McpServer): void {
  const handler = async (input: Input) => {
    const readiness = calculateReadiness(input.raw_idea, input.known_context);
    const clarification = generateClarification(
      input.raw_idea,
      readiness,
      input.scenario,
      input.target_platform,
      input.strictness,
      input.known_context
    );
    const markdown = formatInterrogateResult(readiness, clarification);
    const structuredContent = buildInterrogateStructuredOutput(readiness, clarification);

    return {
      content: [{ type: "text" as const, text: markdown }],
      structuredContent,
    };
  };

  server.registerTool(
    "spec_interrogate",
    {
      title: "需求追问",
      description:
        "分析用户的原始 idea 或页面修改需求，判断信息是否足够进入开发阶段。当信息缺失较多时，输出追问问题清单。",
      inputSchema: SpecInterrogateInputSchema.shape,
      outputSchema: SpecInterrogateOutputSchema.shape,
    },
    handler
  );
}
