import { z } from "zod";

export const UiTranslateOutputSchema = z.object({
  translation: z.object({
    originalDescription: z.string(),
    identifiedIntent: z.string(),
    frontendTerms: z.array(z.string()),
    modificationPrompt: z.string(),
    suggestedComponent: z.string(),
    codeHints: z.array(z.string()),
  }),
  confidence: z.enum(["low", "medium", "high"]),
});

export type UiTranslateOutput = z.infer<typeof UiTranslateOutputSchema>;
