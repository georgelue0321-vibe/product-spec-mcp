import { z } from "zod";
import { looseBoolean, looseNumber } from "./coercion.js";

export const SpecCompileInputSchema = z.object({
  raw_idea: z.string().describe("用户原始想法"),
  answers: z
    .record(z.string(), z.any())
    .optional()
    .describe("用户对追问的回答"),
  allow_assumptions: looseBoolean
    .optional()
    .default(true)
    .describe("是否允许使用默认假设"),
  min_readiness_score: looseNumber
    .optional()
    .default(70)
    .describe("最低可接受的 readiness 分数"),
});

export type SpecCompileInput = z.infer<typeof SpecCompileInputSchema>;
