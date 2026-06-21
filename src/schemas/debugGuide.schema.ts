import { z } from "zod";

export const DebugGuideInputSchema = z.object({
  platform: z
    .enum(["web", "mini_program", "app", "backend", "build", "unknown"])
    .describe("出错平台"),
  error_description: z.string().describe("错误描述"),
  current_info: z
    .record(z.string(), z.any())
    .optional()
    .describe("已知的错误信息"),
});

export type DebugGuideInput = z.infer<typeof DebugGuideInputSchema>;
