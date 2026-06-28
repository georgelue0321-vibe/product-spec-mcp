import { z } from "zod";
import { looseBoolean, looseStringArray } from "./coercion.js";

export const ArchitectureDecideInputSchema = z.object({
  product_type: z.string().describe("产品类型描述"),
  platform: z
    .enum(["web", "mini_program", "app", "backend"])
    .describe("目标平台"),
  features: looseStringArray("功能列表"),
  commercial_intent: looseBoolean
    .optional()
    .default(false)
    .describe("是否有商业化意图"),
  expected_users: z
    .enum(["individual", "small_team", "enterprise", "massive"])
    .optional()
    .default("individual")
    .describe("预期用户规模"),
});

export type ArchitectureDecideInput = z.infer<
  typeof ArchitectureDecideInputSchema
>;
