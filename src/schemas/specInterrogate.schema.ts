import { z } from "zod";

export const SpecInterrogateInputSchema = z.object({
  raw_idea: z.string().describe("用户原始表达，必填"),
  scenario: z
    .enum(["build_product", "modify_ui", "debug", "launch", "unknown"])
    .optional()
    .default("unknown")
    .describe("场景类型"),
  target_platform: z
    .enum(["web", "mini_program", "app", "backend", "unknown"])
    .optional()
    .default("unknown")
    .describe("目标平台"),
  strictness: z
    .enum(["light", "normal", "grill"])
    .optional()
    .default("normal")
    .describe("追问严格程度"),
  known_context: z
    .record(z.string(), z.any())
    .optional()
    .describe("已知上下文信息"),
});

export type SpecInterrogateInput = z.infer<typeof SpecInterrogateInputSchema>;
