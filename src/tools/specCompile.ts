import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SpecCompileInputSchema } from "../schemas/specCompile.schema.js";
import { SpecCompileOutputSchema } from "../schemas/outputs/specCompile.output.js";
import { calculateReadiness } from "../core/specReadiness.js";
import { generateClarification } from "../core/clarificationEngine.js";
import { buildSpec } from "../core/promptBuilder.js";
import { buildConfirmation } from "../core/confirmationBuilder.js";
import { formatCompileResult } from "../core/markdownFormatter.js";
import { buildCompileStructuredOutput } from "../core/structuredResultBuilder.js";
import type { z } from "zod";

type Input = z.infer<typeof SpecCompileInputSchema>;

export function registerSpecCompile(server: McpServer): void {
  const handler = async (input: Input) => {
    const context = { ...input.answers };
    const readiness = calculateReadiness(input.raw_idea, context);

    if (
      readiness.score < input.min_readiness_score &&
      !input.allow_assumptions
    ) {
      const clarification = generateClarification(
        input.raw_idea,
        readiness,
        "unknown",
        "unknown",
        "normal",
        context
      );
      const markdown = formatCompileResult("not_ready", readiness, clarification);
      const structuredContent = buildCompileStructuredOutput(
        "not_ready",
        readiness,
        undefined,
        undefined,
        clarification
      );
      return {
        content: [{ type: "text" as const, text: markdown }],
        structuredContent,
      };
    }

    const spec = buildSpec(input.raw_idea, context, readiness);
    const confirmation = buildConfirmation(spec);
    const mode = readiness.score < input.min_readiness_score ? "draft" : "formal";
    const markdown = formatCompileResult(mode, readiness, undefined, spec, confirmation);
    const structuredContent = buildCompileStructuredOutput(
      mode,
      readiness,
      spec,
      confirmation
    );

    return {
      content: [{ type: "text" as const, text: markdown }],
      structuredContent,
    };
  };

  server.registerTool(
    "spec_compile",
    {
      title: "规格编译",
      description:
        "编译完整产品规格和开发 Prompt。根据信息完整度输出追问、草案或正式规格。",
      inputSchema: SpecCompileInputSchema.shape,
      outputSchema: SpecCompileOutputSchema.shape,
    },
    handler
  );
}
