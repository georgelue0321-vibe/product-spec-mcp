import type { ReadinessResult } from "./specReadiness.js";
import type { ClarificationResult } from "./clarificationEngine.js";
import type { SpecResult } from "./promptBuilder.js";
import type { ConfirmationResult } from "./confirmationBuilder.js";
import type { ArchitectureDecision } from "./architectureEngine.js";
import type { UiTranslation } from "./uiPromptEngine.js";
import type { DebugGuideResult } from "./debugEngine.js";
import type { AcceptanceResult } from "./acceptanceEngine.js";
import type { TechnicalProfile } from "./technicalProfile.js";
import type { PmIntentDecision } from "./pmIntentGate.js";
import type { SpecInterrogateOutput } from "../schemas/outputs/specInterrogate.output.js";
import type { SpecCompileOutput } from "../schemas/outputs/specCompile.output.js";
import type { AcceptanceGenerateOutput } from "../schemas/outputs/acceptanceGenerate.output.js";
import type { ArchitectureDecideOutput } from "../schemas/outputs/architectureDecide.output.js";
import type { UiTranslateOutput } from "../schemas/outputs/uiTranslate.output.js";
import type { DebugGuideOutput } from "../schemas/outputs/debugGuide.output.js";

export function buildInterrogateStructuredOutput(
  readiness: ReadinessResult,
  clarification: ClarificationResult,
  technicalProfile?: TechnicalProfile,
  pmIntentDecision?: PmIntentDecision
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
    technicalProfile,
    pmIntentDecision,
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
    inputConsumption: spec?.inputConsumption,
    technicalProfile: spec?.technicalProfile,
    pmIntentDecision: spec?.pmIntentDecision,
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
          technicalProfile: spec.technicalProfile,
          pmIntentDecision: spec.pmIntentDecision,
          inputConsumption: spec.inputConsumption,
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
    technicalProfile: acceptance.technicalProfile,
    pmIntentDecision: acceptance.pmIntentDecision,
    categories: acceptance.categories,
    definitionOfDone: acceptance.definitionOfDone,
    checklist,
  };
}

export function buildArchitectureStructuredOutput(
  decision: ArchitectureDecision
): ArchitectureDecideOutput {
  const blockers: string[] = [];
  if (decision.paymentRisk) blockers.push("支付回调和支付金额必须后端处理");
  if (decision.aiKeyRisk) blockers.push("AI API Key 不能暴露在前端");
  if (decision.needAuth) blockers.push("登录态和权限校验必须后端处理");
  if (decision.needAdmin) {
    if (decision.domain === "content_community") {
      blockers.push("文章审核、评论隐藏和举报处理接口必须管理员鉴权");
    } else if (decision.domain === "appointment") {
      blockers.push("服务、时间段和预约管理接口必须管理员鉴权");
    } else if (decision.domain === "digital_commerce") {
      blockers.push("商品、订单和下载记录接口必须管理员鉴权");
    } else if (decision.domain === "ticket_workflow") {
      blockers.push("工单分派、处理人权限和状态流转接口必须后端鉴权");
    } else if (decision.domain === "knowledge_base") {
      blockers.push("文档草稿、发布、权限和搜索接口必须后端鉴权并按权限过滤");
    } else if (decision.domain === "crm") {
      blockers.push("客户归属、销售权限、负责人分配和跟进记录接口必须后端鉴权");
    } else {
      blockers.push("后台列表、搜索和导出接口必须鉴权");
    }
  }

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
      capacityRisk: decision.capacityRisk,
      domain: decision.domain,
      mvpSuggestion: decision.mvpSuggestion,
      productionSuggestion: decision.productionSuggestion,
      reasoning: decision.reasoning,
      pmIntentDecision: decision.pmIntentDecision,
    },
    technicalProfile: decision.technicalProfile,
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
