import { z } from "zod";
import { TechnicalProfileSchema } from "../technicalProfile.schema.js";

export const SpecInterrogateOutputSchema = z.object({
  readiness: z.object({
    score: z.number(),
    status: z.enum(["Not Ready", "Draft Ready", "Build Ready"]),
    fields: z.record(
      z.object({
        weight: z.number(),
        present: z.boolean(),
        value: z.string().optional(),
      })
    ),
  }),
  clarification: z.object({
    missingFields: z.array(z.string()),
    questions: z.array(
      z.object({
        field: z.string(),
        question: z.string(),
        example: z.string().optional(),
        whyImportant: z.string(),
        options: z.array(z.string()),
        defaultAssumption: z.string(),
        priority: z.string(),
      })
    ),
    defaultAssumptions: z.record(z.string()),
  }),
  recommendation: z.object({
    canProceed: z.boolean(),
    suggestedNextTool: z.enum(["spec_compile", "spec_interrogate"]),
    reason: z.string(),
  }),
  technicalProfile: TechnicalProfileSchema.optional(),
});

export type SpecInterrogateOutput = z.infer<typeof SpecInterrogateOutputSchema>;
