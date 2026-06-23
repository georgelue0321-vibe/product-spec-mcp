import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SpecCompileInputSchema } from "../schemas/specCompile.schema.js";
import { SpecCompileOutputSchema } from "../schemas/outputs/specCompile.output.js";
import { calculateReadiness } from "../core/specReadiness.js";
import { generateClarification } from "../core/clarificationEngine.js";
import { buildSpec } from "../core/promptBuilder.js";
import { buildConfirmation } from "../core/confirmationBuilder.js";
import { formatCompileResult } from "../core/markdownFormatter.js";
import { buildCompileStructuredOutput } from "../core/structuredResultBuilder.js";
import { buildTechnicalProfile } from "../core/technicalProfile.js";
import type { z } from "zod";

type Input = z.infer<typeof SpecCompileInputSchema>;

export function registerSpecCompile(server: McpServer): void {
  const handler = async (input: Input) => {
    const context = { ...input.answers };
    const readiness = calculateReadiness(input.raw_idea, context);
    const technicalProfile = buildTechnicalProfile(input.raw_idea, context);

    const hasStructuredAnswers = Object.keys(context).length >= 3;

    if (
      readiness.score < input.min_readiness_score &&
      !input.allow_assumptions &&
      !hasStructuredAnswers
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
      structuredContent.technicalProfile = technicalProfile;
      return {
        content: [{ type: "text" as const, text: markdown }],
        structuredContent,
      };
    }

    const spec = buildSpec(input.raw_idea, context, readiness);
    const effectiveReadiness = {
      ...readiness,
      score: spec.readinessScore,
      status: spec.readinessStatus as typeof readiness.status,
    };
    const confirmation = buildConfirmation(spec);
    const mode = spec.isActionable && effectiveReadiness.score >= input.min_readiness_score ? "formal" : "draft";
    const markdown = formatCompileResult(mode, effectiveReadiness, undefined, spec, confirmation);
    const structuredContent = buildCompileStructuredOutput(
      mode,
      effectiveReadiness,
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
