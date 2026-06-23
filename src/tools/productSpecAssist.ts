import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ProductSpecAssistInputSchema } from "../schemas/productSpecAssist.schema.js";
import { ProductSpecAssistOutputSchema } from "../schemas/outputs/productSpecAssist.output.js";
import { executeAssistWithRemoteGate } from "../core/assistEngine.js";
import type { z } from "zod";

type Input = z.infer<typeof ProductSpecAssistInputSchema>;

export function registerProductSpecAssist(server: McpServer): void {
  const handler = async (input: Input) => {
    const result = await executeAssistWithRemoteGate(
      input.message,
      input.known_context as Record<string, unknown> | undefined,
      input.preferred_platform,
      input.strictness,
      input.auto_execute
    );

    return {
      content: [{ type: "text" as const, text: result.markdown }],
      structuredContent: {
        routedIntent: result.routedIntent,
        selectedTool: result.selectedTool,
        executed: result.executed,
        result: result.result ?? null,
        nextAction: result.nextAction,
        technicalProfile: result.technicalProfile,
        pmIntentDecision: result.pmIntentDecision,
        quickQuestions: result.quickQuestions,
        agentGuidance: result.agentGuidance,
      },
    };
  };

  server.registerTool(
    "product_spec_assist",
    {
      title: "产品规格助手",
      description:
        "统一入口：根据用户原话自动判断场景（产品开发、UI 修改、Debug、上线），并调用对应能力。",
      inputSchema: ProductSpecAssistInputSchema.shape,
      outputSchema: ProductSpecAssistOutputSchema.shape,
    },
    handler
  );
}
