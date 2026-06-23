import { z } from "zod";

export const TechnicalProfileSchema = z.object({
  shape: z.enum([
    "static_page",
    "local_storage_tool",
    "local_json_import_export",
    "static_json_data_page",
    "light_backend_json_sqlite",
    "full_backend_saas",
    "unknown",
  ]),
  confidence: z.enum(["high", "medium", "low"]),
  frontendOnly: z.boolean(),
  needsBackend: z.boolean(),
  needsAuth: z.boolean(),
  needsAdmin: z.boolean(),
  suggestedStorage: z.enum([
    "none",
    "localStorage",
    "indexedDB",
    "static_json",
    "json_file",
    "sqlite",
    "postgresql",
  ]),
  evidence: z.array(z.string()),
  blockers: z.array(z.string()),
  nextQuestions: z.array(
    z.object({
      question: z.string(),
      example: z.string(),
      why: z.string(),
    })
  ),
});

export type TechnicalProfileOutput = z.infer<typeof TechnicalProfileSchema>;
