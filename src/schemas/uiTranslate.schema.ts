import { z } from "zod";

export const UiTranslateInputSchema = z.object({
  description: z.string().describe("用户原始描述"),
  current_page: z
    .string()
    .optional()
    .describe("当前页面名称"),
  target_component: z
    .string()
    .optional()
    .describe("目标组件名称"),
});

export type UiTranslateInput = z.infer<typeof UiTranslateInputSchema>;
