import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DebugGuideInputSchema } from "../schemas/debugGuide.schema.js";
import { DebugGuideOutputSchema } from "../schemas/outputs/debugGuide.output.js";
import { generateDebugGuide } from "../core/debugEngine.js";
import { formatDebugGuideResult } from "../core/markdownFormatter.js";
import { buildDebugGuideStructuredOutput } from "../core/structuredResultBuilder.js";
import type { z } from "zod";

type Input = z.infer<typeof DebugGuideInputSchema>;

export function registerDebugGuide(server: McpServer): void {
  const handler = async (input: Input) => {
    const guide = generateDebugGuide(
      input.platform,
      input.error_description,
      input.current_info
    );
    const markdown = formatDebugGuideResult(guide);
    const structuredContent = buildDebugGuideStructuredOutput(guide);

    return {
      content: [{ type: "text" as const, text: markdown }],
      structuredContent,
    };
  };

  server.registerTool(
    "debug_guide",
    {
      title: "Debug 指引",
      description:
        "当用户说程序出错时，引导用户提供正确错误信息，并生成结构化排查步骤。",
      inputSchema: DebugGuideInputSchema.shape,
      outputSchema: DebugGuideOutputSchema.shape,
    },
    handler
  );
}
