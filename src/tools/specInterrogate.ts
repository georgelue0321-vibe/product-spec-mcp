import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SpecInterrogateInputSchema } from "../schemas/specInterrogate.schema.js";
import { SpecInterrogateOutputSchema } from "../schemas/outputs/specInterrogate.output.js";
import { calculateReadiness } from "../core/specReadiness.js";
import { generateClarification } from "../core/clarificationEngine.js";
import { formatInterrogateResult } from "../core/markdownFormatter.js";
import { buildInterrogateStructuredOutput } from "../core/structuredResultBuilder.js";
import { buildTechnicalProfile } from "../core/technicalProfile.js";
import { decidePmIntent } from "../core/pmIntentGate.js";
import {
  buildPmGateClarification,
  buildPmGateReadiness,
  formatPmGateInterrogateResult,
  shouldUsePmGateClarification,
} from "../core/pmGateClarification.js";
import type { z } from "zod";

type Input = z.infer<typeof SpecInterrogateInputSchema>;

export function registerSpecInterrogate(server: McpServer): void {
  const handler = async (input: Input) => {
    const readiness = calculateReadiness(input.raw_idea, input.known_context);
    const technicalProfile = buildTechnicalProfile(input.raw_idea, input.known_context || {});
    const pmIntentDecision = decidePmIntent(input.raw_idea, input.known_context || {});
    const usePmGate = input.scenario !== "modify_ui" && shouldUsePmGateClarification(pmIntentDecision);
    const effectiveReadiness = usePmGate ? buildPmGateReadiness(pmIntentDecision, readiness) : readiness;
    const clarification = usePmGate ? buildPmGateClarification(pmIntentDecision) : generateClarification(
      input.raw_idea,
      effectiveReadiness,
      input.scenario,
      input.target_platform,
      input.strictness,
      input.known_context
    );
    const markdown = usePmGate
      ? formatPmGateInterrogateResult(pmIntentDecision, effectiveReadiness, clarification)
      : formatInterrogateResult(effectiveReadiness, clarification);
    const structuredContent = buildInterrogateStructuredOutput(
      effectiveReadiness,
      clarification,
      technicalProfile,
      usePmGate ? pmIntentDecision : undefined
    );

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
