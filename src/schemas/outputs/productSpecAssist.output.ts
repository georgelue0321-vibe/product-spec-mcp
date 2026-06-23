import { z } from "zod";
import { SpecInterrogateOutputSchema } from "./specInterrogate.output.js";
import { SpecCompileOutputSchema } from "./specCompile.output.js";
import { UiTranslateOutputSchema } from "./uiTranslate.output.js";
import { DebugGuideOutputSchema } from "./debugGuide.output.js";
import { ArchitectureDecideOutputSchema } from "./architectureDecide.output.js";
import { TechnicalProfileSchema } from "../technicalProfile.schema.js";
import { PmIntentDecisionSchema } from "../pmIntentDecision.schema.js";

const QuickQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  example: z.string().optional(),
  whyImportant: z.string(),
  priority: z.enum(["P0", "P1", "P2"]),
  defaultValue: z.string(),
  mapsTo: z.array(z.string()),
  options: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      recommended: z.boolean().optional(),
      description: z.string().optional(),
    })
  ),
});

export const ProductSpecAssistOutputSchema = z.object({
  routedIntent: z.object({
    intent: z.string(),
    scenario: z.enum(["build_product", "modify_ui", "debug", "launch", "unknown"]),
    confidence: z.number(),
  }),
  selectedTool: z.string().nullable(),
  executed: z.boolean(),
  result: z
    .union([
      SpecInterrogateOutputSchema,
      SpecCompileOutputSchema,
      UiTranslateOutputSchema,
      DebugGuideOutputSchema,
      ArchitectureDecideOutputSchema,
    ])
    .nullable(),
  nextAction: z.object({
    type: z.enum([
      "answer_questions",
      "compile_spec",
      "confirm_spec",
      "translate_ui",
      "provide_debug_info",
      "review_launch_readiness",
      "choose_tool_manually",
    ]),
    message: z.string(),
    suggestedTool: z.string().optional(),
  }),
  technicalProfile: TechnicalProfileSchema.optional(),
  pmIntentDecision: PmIntentDecisionSchema.optional(),
  quickQuestions: z.array(QuickQuestionSchema),
  agentGuidance: z.array(z.string()),
});

export type ProductSpecAssistOutput = z.infer<typeof ProductSpecAssistOutputSchema>;
