import { z } from "zod";
import { TechnicalProfileSchema } from "../technicalProfile.schema.js";

export const ArchitectureDecideOutputSchema = z.object({
  decision: z.object({
    canBeFrontendOnly: z.boolean(),
    needBackend: z.boolean(),
    needSeparation: z.boolean(),
    recommendedDatabase: z.string(),
    needAuth: z.boolean(),
    needAdmin: z.boolean(),
    needLogging: z.boolean(),
    paymentRisk: z.boolean(),
    aiKeyRisk: z.boolean(),
    capacityRisk: z.boolean().optional(),
    domain: z.string().optional(),
    mvpSuggestion: z.string(),
    productionSuggestion: z.string(),
    reasoning: z.array(z.string()),
  }),
  technicalProfile: TechnicalProfileSchema.optional(),
  riskLevel: z.enum(["low", "medium", "high"]),
  blockers: z.array(z.string()),
});

export type ArchitectureDecideOutput = z.infer<typeof ArchitectureDecideOutputSchema>;
