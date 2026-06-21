import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UiTranslateInputSchema } from "../schemas/uiTranslate.schema.js";
import { UiTranslateOutputSchema } from "../schemas/outputs/uiTranslate.output.js";
import { translateUiDescription } from "../core/uiPromptEngine.js";
import { formatUiTranslateResult } from "../core/markdownFormatter.js";
import { buildUiTranslateStructuredOutput } from "../core/structuredResultBuilder.js";
import type { z } from "zod";

type Input = z.infer<typeof UiTranslateInputSchema>;

export function registerUiTranslate(server: McpServer): void {
  const handler = async (input: Input) => {
    const translation = translateUiDescription(
      input.description,
      input.current_page,
      input.target_component
    );
    const markdown = formatUiTranslateResult(translation);
    const structuredContent = buildUiTranslateStructuredOutput(translation);

    return {
      content: [{ type: "text" as const, text: markdown }],
      structuredContent,
    };
  };

  server.registerTool(
    "ui_translate",
    {
      title: "UI 术语翻译",
      description:
        "把普通用户的页面修改描述翻译成前端开发术语和可执行修改 Prompt。",
      inputSchema: UiTranslateInputSchema.shape,
      outputSchema: UiTranslateOutputSchema.shape,
    },
    handler
  );
}
