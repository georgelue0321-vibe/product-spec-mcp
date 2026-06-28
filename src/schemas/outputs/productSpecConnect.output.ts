import { z } from "zod";

export const ProductSpecConnectOutputSchema = z.object({
  configured: z.boolean(),
  connectUrl: z.string(),
  env: z.record(z.string()).optional(),
  steps: z.array(z.string()),
  warnings: z.array(z.string()),
  isError: z.boolean().optional(),
});

export type ProductSpecConnectOutput = z.infer<typeof ProductSpecConnectOutputSchema>;
