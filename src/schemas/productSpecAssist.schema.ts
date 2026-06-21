import { z } from "zod";

export const ProductSpecAssistInputSchema = z.object({
  message: z.string().describe("用户原话，必填"),
  known_context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("已有上下文"),
  preferred_platform: z
    .enum(["web", "mini_program", "app", "backend", "unknown"])
    .optional()
    .default("unknown")
    .describe("用户已知平台"),
  strictness: z
    .enum(["light", "normal", "grill"])
    .optional()
    .default("normal")
    .describe("追问强度"),
  auto_execute: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否允许自动调用对应 engine"),
});

export type ProductSpecAssistInput = z.infer<typeof ProductSpecAssistInputSchema>;
