import { z } from "zod";

export const SpecCompileOutputSchema = z.object({
  mode: z.enum(["not_ready", "draft", "formal"]),
  readiness: z.object({
    score: z.number(),
    status: z.string(),
  }),
  spec: z
    .object({
      productGoal: z.string(),
      targetUser: z.string(),
      platform: z.string(),
      coreFeatures: z.array(z.string()),
      dataModel: z.string(),
      architecture: z.string(),
      apiDesign: z.string(),
      riskBoundaries: z.array(z.string()),
      nonGoals: z.array(z.string()),
      successCriteria: z.array(z.string()),
      assumptions: z.array(z.string()),
    })
    .optional(),
  confirmation: z
    .object({
      items: z.array(z.string()),
    })
    .optional(),
  clarification: z
    .object({
      missingFields: z.array(z.string()),
      questions: z.array(z.unknown()),
      defaultAssumptions: z.record(z.string()),
    })
    .optional(),
  nextAction: z.object({
    type: z.enum(["answer_questions", "confirm_spec", "start_build"]),
    message: z.string(),
  }),
});

export type SpecCompileOutput = z.infer<typeof SpecCompileOutputSchema>;
