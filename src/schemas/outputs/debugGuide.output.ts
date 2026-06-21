import { z } from "zod";

export const DebugGuideOutputSchema = z.object({
  guide: z.object({
    platform: z.string(),
    requiredInfo: z.array(
      z.object({
        field: z.string(),
        description: z.string(),
        how_to_get: z.string(),
        priority: z.string(),
      })
    ),
    knownInfo: z.record(z.unknown()),
    checklist: z.array(z.string()),
    commonIssues: z.array(z.string()),
    troubleshootingSteps: z.array(z.string()),
  }),
  missingRequiredInfo: z.array(z.string()),
  canDiagnoseNow: z.boolean(),
});

export type DebugGuideOutput = z.infer<typeof DebugGuideOutputSchema>;
