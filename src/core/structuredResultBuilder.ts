import type { ReadinessResult } from "./specReadiness.js";
import type { ClarificationResult } from "./clarificationEngine.js";
import type { SpecResult } from "./promptBuilder.js";
import type { ConfirmationResult } from "./confirmationBuilder.js";
import type { ArchitectureDecision } from "./architectureEngine.js";
import type { UiTranslation } from "./uiPromptEngine.js";
import type { DebugGuideResult } from "./debugEngine.js";
import type { AcceptanceResult } from "./acceptanceEngine.js";
import type { SpecInterrogateOutput } from "../schemas/outputs/specInterrogate.output.js";
import type { SpecCompileOutput } from "../schemas/outputs/specCompile.output.js";
import type { AcceptanceGenerateOutput } from "../schemas/outputs/acceptanceGenerate.output.js";
import type { ArchitectureDecideOutput } from "../schemas/outputs/architectureDecide.output.js";
import type { UiTranslateOutput } from "../schemas/outputs/uiTranslate.output.js";
import type { DebugGuideOutput } from "../schemas/outputs/debugGuide.output.js";

export function buildInterrogateStructuredOutput(
  readiness: ReadinessResult,
  clarification: ClarificationResult
): SpecInterrogateOutput {
  const canProceed = readiness.status !== "Not Ready";
  return {
    readiness: {
      score: readiness.score,
      status: readiness.status,
      fields: readiness.fields,
    },
    clarification: {
      missingFields: clarification.missingFields,
      questions: clarification.questions,
      defaultAssumptions: clarification.defaultAssumptions,
    },
    recommendation: {
      canProceed,
      suggestedNextTool: canProceed ? "spec_compile" : "spec_interrogate",
      reason: canProceed
        ? readiness.status === "Build Ready"
          ? "信息充足，可以生成正式规格"
          : "信息部分完整，可以生成草案"
        : "信息不足，需要先回答追问",
    },
  };
}

export function buildCompileStructuredOutput(
  mode: "not_ready" | "draft" | "formal",
  readiness: ReadinessResult,
  spec?: SpecResult,
  confirmation?: ConfirmationResult,
  clarification?: ClarificationResult
): SpecCompileOutput {
  const nextActionType =
    mode === "not_ready"
      ? "answer_questions"
      : mode === "draft"
      ? "confirm_spec"
      : "start_build";

  const nextActionMessage =
    mode === "not_ready"
      ? "请先回答追问问题"
      : mode === "draft"
      ? "请确认规格中的默认假设"
      : "可以开始开发";

  return {
    mode,
    readiness: {
      score: readiness.score,
      status: readiness.status,
    },
    spec: spec
      ? {
          productGoal: spec.productGoal,
          targetUser: spec.targetUser,
          platform: spec.platform,
          coreFeatures: spec.coreFeatures,
          dataModel: spec.dataModel,
          architecture: spec.architecture,
          apiDesign: spec.apiDesign,
          riskBoundaries: spec.riskBoundaries,
          nonGoals: spec.nonGoals,
          successCriteria: spec.successCriteria,
          assumptions: spec.assumptions,
        }
      : undefined,
    confirmation: confirmation
      ? { items: confirmation.items }
      : undefined,
    clarification: clarification
      ? {
          missingFields: clarification.missingFields,
          questions: clarification.questions,
          defaultAssumptions: clarification.defaultAssumptions,
        }
      : undefined,
    nextAction: {
      type: nextActionType,
      message: nextActionMessage,
    },
  };
}

export function buildAcceptanceStructuredOutput(
  acceptance: AcceptanceResult
): AcceptanceGenerateOutput {
  const checklist: AcceptanceGenerateOutput["checklist"] = [];
  let itemIndex = 0;

  for (const cat of acceptance.categories) {
    for (const item of cat.items) {
      checklist.push({
        id: `${cat.category.toLowerCase().replace(/\s+/g, "-")}-${++itemIndex}`,
        category: cat.category,
        text: item,
        required: true,
      });
    }
  }

  for (const item of acceptance.definitionOfDone) {
    checklist.push({
      id: `dod-${++itemIndex}`,
      category: "Definition of Done",
      text: item,
      required: true,
    });
  }

  return {
    productType: acceptance.productType,
    platform: acceptance.platform,
    categories: acceptance.categories,
    definitionOfDone: acceptance.definitionOfDone,
    checklist,
  };
}

export function buildArchitectureStructuredOutput(
  decision: ArchitectureDecision
): ArchitectureDecideOutput {
  const blockers: string[] = [];
  if (decision.paymentRisk) blockers.push("支付回调必须后端处理");
  if (decision.aiKeyRisk) blockers.push("AI API Key 不能暴露在前端");

  const riskLevel = blockers.length > 0 ? "high" : decision.needBackend ? "medium" : "low";

  return {
    decision: {
      canBeFrontendOnly: decision.canBeFrontendOnly,
      needBackend: decision.needBackend,
      needSeparation: decision.needSeparation,
      recommendedDatabase: decision.recommendedDatabase,
      needAuth: decision.needAuth,
      needAdmin: decision.needAdmin,
      needLogging: decision.needLogging,
      paymentRisk: decision.paymentRisk,
      aiKeyRisk: decision.aiKeyRisk,
      mvpSuggestion: decision.mvpSuggestion,
      productionSuggestion: decision.productionSuggestion,
      reasoning: decision.reasoning,
    },
    riskLevel,
    blockers,
  };
}

export function buildUiTranslateStructuredOutput(
  translation: UiTranslation
): UiTranslateOutput {
  const confidence =
    translation.frontendTerms.length > 0 &&
    !translation.frontendTerms.includes("需要进一步明确具体修改区域")
      ? "high"
      : translation.identifiedIntent === "未明确识别"
      ? "low"
      : "medium";

  return {
    translation: {
      originalDescription: translation.originalDescription,
      identifiedIntent: translation.identifiedIntent,
      frontendTerms: translation.frontendTerms,
      modificationPrompt: translation.modificationPrompt,
      suggestedComponent: translation.suggestedComponent,
      codeHints: translation.codeHints,
    },
    confidence,
  };
}

export function buildDebugGuideStructuredOutput(
  guide: DebugGuideResult
): DebugGuideOutput {
  const missingRequiredInfo = guide.requiredInfo
    .filter((info: { field: string }) => !guide.knownInfo[info.field])
    .map((info: { field: string }) => info.field);

  return {
    guide: {
      platform: guide.platform,
      requiredInfo: guide.requiredInfo,
      knownInfo: guide.knownInfo,
      checklist: guide.checklist,
      commonIssues: guide.commonIssues,
      troubleshootingSteps: guide.troubleshootingSteps,
    },
    missingRequiredInfo,
    canDiagnoseNow: missingRequiredInfo.length === 0,
  };
}
