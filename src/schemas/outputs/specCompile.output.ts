import { z } from "zod";
import { TechnicalProfileSchema } from "../technicalProfile.schema.js";

export const SpecCompileOutputSchema = z.object({
  mode: z.enum(["not_ready", "draft", "formal"]),
  readiness: z.object({
    score: z.number(),
    status: z.string(),
  }),
  inputConsumption: z
    .object({
      consumedAnswers: z.array(z.string()),
      unusedAnswers: z.array(z.string()),
      matchedDomain: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
    })
    .optional(),
  technicalProfile: TechnicalProfileSchema.optional(),
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
      technicalProfile: TechnicalProfileSchema.optional(),
      inputConsumption: z
        .object({
          consumedAnswers: z.array(z.string()),
          unusedAnswers: z.array(z.string()),
          matchedDomain: z.string(),
          confidence: z.enum(["high", "medium", "low"]),
        })
        .optional(),
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
