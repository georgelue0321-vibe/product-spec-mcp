import { z } from "zod";
import { TechnicalProfileSchema } from "../technicalProfile.schema.js";

export const AcceptanceGenerateOutputSchema = z.object({
  productType: z.string(),
  platform: z.string(),
  technicalProfile: TechnicalProfileSchema.optional(),
  categories: z.array(
    z.object({
      category: z.string(),
      items: z.array(z.string()),
    })
  ),
  definitionOfDone: z.array(z.string()),
  checklist: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      text: z.string(),
      required: z.boolean(),
    })
  ),
});

export type AcceptanceGenerateOutput = z.infer<typeof AcceptanceGenerateOutputSchema>;
