import { z } from "zod";

export const AcceptanceGenerateInputSchema = z.object({
  product_type: z.string().describe("产品类型"),
  features: z.array(z.string()).describe("功能列表"),
  platform: z
    .enum(["web", "mini_program", "app", "backend"])
    .describe("目标平台"),
  has_backend: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否有后端"),
  has_payment: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否涉及支付"),
  has_auth: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否涉及鉴权"),
});

export type AcceptanceGenerateInput = z.infer<
  typeof AcceptanceGenerateInputSchema
>;
