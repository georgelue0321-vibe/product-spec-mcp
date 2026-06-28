import { z } from "zod";
import { looseBoolean, looseStringArray } from "./coercion.js";

export const AcceptanceGenerateInputSchema = z.object({
  product_type: z.string().describe("产品类型"),
  features: looseStringArray("功能列表"),
  platform: z
    .enum(["web", "mini_program", "app", "backend"])
    .describe("目标平台"),
  has_backend: looseBoolean
    .optional()
    .default(false)
    .describe("是否有后端"),
  has_payment: looseBoolean
    .optional()
    .default(false)
    .describe("是否涉及支付"),
  has_auth: looseBoolean
    .optional()
    .default(false)
    .describe("是否涉及鉴权"),
});

export type AcceptanceGenerateInput = z.infer<
  typeof AcceptanceGenerateInputSchema
>;
